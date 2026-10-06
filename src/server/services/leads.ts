/**
 * Lead lifecycle: turning a website submission into a person and lead, intake
 * edits, the conflict card, and stage changes. Every stage change is timestamped
 * so each step's conversion and speed can be measured.
 */
import { randomUUID } from "node:crypto";
import type { LeadRecord } from "@/lib/crm";
import type { QuizAnswers } from "@/lib/quiz";
import { audit, type AuditActor } from "@/server/audit/log";
import { assertCan, canOnLead } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { assertValueQuestionClear, attributeLead, partnerSegments } from "@/server/services/partners";
import type { Actor, ConflictParty, ExitReason, HouseholdMember, Intake, Lead, MatterType, Person, Stage } from "@/server/types";

export const MATTER_LABELS: Record<MatterType, string> = {
  new_plan: "New estate plan",
  update_plan: "Update an existing plan",
  administration: "Trust or probate administration",
  elder_law: "Elder law or long-term care",
  special_needs: "Special needs planning",
  business_succession: "Business succession",
};

export function matterTypeFromQuiz(a: Partial<QuizAnswers>): MatterType {
  switch (a.matterType) {
    case "after_death":
      return "administration";
    case "elder_care":
      return "elder_law";
    case "update_plan":
      return "update_plan";
    default:
      if (a.specialNeeds === "yes") return "special_needs";
      return "new_plan";
  }
}

/**
 * The summary sent with an offer. It names no one and carries no assets or
 * health detail: just enough for a lawyer to judge fit before the conflict check.
 */
export function offerSummary(lead: Pick<Lead, "matterType" | "state" | "county" | "urgent" | "score">): string {
  const where = lead.county ? `${lead.county} County, ${lead.state}` : lead.state;
  const urgency = lead.urgent ? "Time-sensitive. " : "";
  return `${urgency}${MATTER_LABELS[lead.matterType]} in ${where}. Intake score ${lead.score.score} (grade ${lead.score.grade}).`;
}

function normalizePhone(p: string) {
  return p.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

/**
 * Finds an existing person by email, phone or browser id so one person never
 * becomes two records. Phone is optional on some forms, so an empty phone never matches.
 */
export async function findPerson(db: Db, email: string, phone: string, visitorId?: string): Promise<Person | undefined> {
  const e = email.trim().toLowerCase();
  const p = normalizePhone(phone);
  const byContact = (await db.persons.list((x) => x.email.toLowerCase() === e || (p !== "" && normalizePhone(x.phone) === p)))[0];
  if (byContact || !visitorId) return byContact;
  const prior = (await db.leads.list((l) => l.visitorId === visitorId))[0];
  return prior ? await db.persons.get(prior.personId) : undefined;
}

export interface IngestOptions {
  /** The caller records the partner referral itself (the partner-submitted form), so ?ref= attribution is skipped. */
  skipPartnerAttribution?: boolean;
}

/**
 * Creates the person (or reuses a match) and a new lead from a website submission. A known partner ref code
 * (?ref= on the landing page) tags the lead and records a referral for that partner.
 */
export async function ingestLead(db: Db, record: LeadRecord, now = new Date(), options: IngestOptions = {}): Promise<Lead> {
  const c = record.contact;
  let person = await findPerson(db, c.email, c.phone, record.visitorId);
  if (!person) {
    person = await db.persons.insert({
      id: randomUUID(),
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: normalizePhone(c.phone),
      language: c.language ?? "English",
      state: c.state,
      county: c.county,
    });
  }
  const a = record.answers;
  // A returning client goes back to the lawyer who handled their last matter.
  const previous = (await db.leads.list((l) => l.personId === person.id && !!l.assignedLawyerId, { personId: person.id }))
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];

  const matterType = matterTypeFromQuiz(a);
  const urgent = record.score.redFlags.length > 0;
  const clientName = `${c.firstName} ${c.lastName}`;
  const intake: Intake = {
    summary: "",
    goals: record.goals,
    redFlags: [...record.score.redFlags],
    deadlines: [],
    household: { maritalStatus: a.maritalStatus, children: a.children, members: [] },
    assets: {
      range: a.assetRange,
      ownsHome: a.ownsHome === undefined ? undefined : a.ownsHome === "yes",
      ownsBusiness: a.ownsBusiness === undefined ? undefined : a.ownsBusiness === "yes",
      outOfStateProperty: a.outOfStateProperty === undefined ? undefined : a.outOfStateProperty === "yes",
    },
    answers: a,
    existingDocuments: a.existingDocuments,
  };
  const at = now.toISOString();
  const base = {
    matterType,
    state: c.state,
    county: c.county,
    urgent,
    score: record.score,
  };
  const lead: Lead = {
    id: record.id,
    personId: person.id,
    createdAt: at,
    stage: "new",
    stageHistory: [{ stage: "new", at, by: "system" }],
    ...base,
    exit: record.score.tier === "not_a_fit" ? { reason: "not_a_fit", at, note: record.score.notFitReason } : undefined,
    segments: [...new Set([...record.segments, ...(options.skipPartnerAttribution ? [] : await partnerSegments(db, record.source.partnerRef))])],
    source: { ...record.source },
    consent: record.consent,
    offerSummary: offerSummary(base),
    conflictCard: { clientName, parties: [], matterType, state: c.state, county: c.county, clearance: "pending" },
    intake,
    previousLawyerId: previous?.assignedLawyerId,
    capture: record.capture,
    priorTools: record.priorTools,
    visitorId: record.visitorId,
  };
  await db.leads.insert(lead);
  await audit(db, "system", { action: "lead.create", resourceType: "lead", resourceId: lead.id, leadId: lead.id, at: now });
  if (!options.skipPartnerAttribution) {
    try {
      await attributeLead(db, lead, record.source.partnerRef, now);
    } catch (err) {
      // Attribution is bookkeeping: a failure must never lose the lead.
      console.error("partner attribution failed", { id: lead.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return lead;
}

export async function setStage(db: Db, actor: AuditActor, leadId: string, stage: Stage, now = new Date()): Promise<Lead> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  if (lead.stage === stage) return lead;
  // A partner-sourced matter cannot be closed until "is anything of value linked to this referral?" is answered No.
  if (stage === "plan_complete" || stage === "annual_review") await assertValueQuestionClear(db, leadId);
  const at = now.toISOString();
  const by = actor === "system" ? "system" : actor.userId;
  const next = await db.leads.update(leadId, { stage, stageHistory: [...lead.stageHistory, { stage, at, by }] });
  await audit(db, actor, { action: "lead.stage", resourceType: "lead", resourceId: leadId, leadId, detail: { from: lead.stage, to: stage }, at: now });
  return next;
}

export async function exitLead(db: Db, actor: AuditActor, leadId: string, reason: ExitReason, note?: string, now = new Date()): Promise<Lead> {
  const next = await db.leads.update(leadId, { exit: { reason, at: now.toISOString(), note } });
  await audit(db, actor, { action: "lead.exit", resourceType: "lead", resourceId: leadId, leadId, detail: { reason }, at: now });
  return next;
}

export interface IntakeUpdate {
  summary?: string;
  goals?: string;
  redFlags?: string[];
  deadlines?: Intake["deadlines"];
  householdMembers?: HouseholdMember[];
  conflictParties?: ConflictParty[];
  outOfStateStates?: string[];
  retirementAccounts?: boolean;
  consultAvailability?: string;
  needsInPerson?: boolean;
}

/** Intake edits. Changing the conflict parties resets clearance, because the check must be re-run. */
export async function updateIntake(db: Db, actor: Actor, leadId: string, update: IntakeUpdate, now = new Date()): Promise<Lead> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  assertCan(canOnLead(actor, "edit_intake", lead, await db.assignments.list(undefined, { leadId }), now));
  if (update.summary !== undefined && update.summary.split("\n").length > 5) {
    throw new Error("Keep the intake summary to five lines");
  }
  const intake: Intake = {
    ...lead.intake,
    summary: update.summary ?? lead.intake.summary,
    goals: update.goals ?? lead.intake.goals,
    redFlags: update.redFlags ?? lead.intake.redFlags,
    deadlines: update.deadlines ?? lead.intake.deadlines,
    household: { ...lead.intake.household, members: update.householdMembers ?? lead.intake.household.members },
    assets: {
      ...lead.intake.assets,
      outOfStateStates: update.outOfStateStates ?? lead.intake.assets.outOfStateStates,
      retirementAccounts: update.retirementAccounts ?? lead.intake.assets.retirementAccounts,
    },
    consultAvailability: update.consultAvailability ?? lead.intake.consultAvailability,
    needsInPerson: update.needsInPerson ?? lead.intake.needsInPerson,
  };
  const conflictCard = update.conflictParties
    ? { ...lead.conflictCard, parties: update.conflictParties, clearance: "pending" as const }
    : lead.conflictCard;
  const urgent = intake.redFlags.length > 0 || intake.deadlines.some((d) => new Date(d.date).getTime() - now.getTime() < 7 * 86_400_000);
  const next = await db.leads.update(leadId, { intake, conflictCard, urgent, offerSummary: offerSummary({ ...lead, urgent }), intakeOwnerId: lead.intakeOwnerId ?? actor.userId });
  await audit(db, actor, { action: "intake.update", resourceType: "lead", resourceId: leadId, leadId, detail: { fields: Object.keys(update) }, at: now });
  return next;
}

/**
 * Records the result of the firm's conflict check. Under the in-firm structure the
 * firm runs its own conflict database against the card; this stores the answer.
 */
export async function recordConflictCheck(db: Db, actor: Actor, leadId: string, result: "clear" | "conflict", now = new Date()): Promise<Lead> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  assertCan(actor.role === "platform_admin" || actor.role === "intake" || actor.role === "firm_admin", "Only intake or firm admins record conflict checks");
  const next = await db.leads.update(leadId, { conflictCard: { ...lead.conflictCard, clearance: result } });
  await audit(db, actor, { action: "conflict.check", resourceType: "lead", resourceId: leadId, leadId, detail: { result }, at: now });
  if (result === "conflict") await exitLead(db, actor, leadId, "conflict", undefined, now);
  else if (lead.stage === "qualified" || lead.stage === "contacted" || lead.stage === "new") await setStage(db, actor, leadId, "conflict_check", now);
  return await db.leads.get(leadId) ?? next;
}
