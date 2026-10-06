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
  return `${urgency}${MATTER_LABELS[lead.matterType]} in ${where}. Intake score ${lead.score.score} (${lead.score.tier}).`;
}

function normalizePhone(p: string) {
  return p.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

/** Finds an existing person by phone or email so one person never becomes two records. */
export function findPerson(db: Db, email: string, phone: string): Person | undefined {
  const e = email.trim().toLowerCase();
  const p = normalizePhone(phone);
  return db.persons.list((x) => x.email.toLowerCase() === e || normalizePhone(x.phone) === p)[0];
}

/** Creates the person (or reuses a match) and a new lead from a website submission. */
export function ingestLead(db: Db, record: LeadRecord, now = new Date()): Lead {
  const c = record.contact;
  let person = findPerson(db, c.email, c.phone);
  if (!person) {
    person = db.persons.insert({
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
  const previous = db.leads
    .list((l) => l.personId === person.id && !!l.assignedLawyerId)
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
    segments: record.segments,
    source: { ...record.source },
    consent: record.consent,
    offerSummary: offerSummary(base),
    conflictCard: { clientName, parties: [], matterType, state: c.state, county: c.county, clearance: "pending" },
    intake,
    previousLawyerId: previous?.assignedLawyerId,
  };
  db.leads.insert(lead);
  audit(db, "system", { action: "lead.create", resourceType: "lead", resourceId: lead.id, leadId: lead.id, at: now });
  return lead;
}

export function setStage(db: Db, actor: AuditActor, leadId: string, stage: Stage, now = new Date()): Lead {
  const lead = db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  if (lead.stage === stage) return lead;
  const at = now.toISOString();
  const by = actor === "system" ? "system" : actor.userId;
  const next = db.leads.update(leadId, { stage, stageHistory: [...lead.stageHistory, { stage, at, by }] });
  audit(db, actor, { action: "lead.stage", resourceType: "lead", resourceId: leadId, leadId, detail: { from: lead.stage, to: stage }, at: now });
  return next;
}

export function exitLead(db: Db, actor: AuditActor, leadId: string, reason: ExitReason, note?: string, now = new Date()): Lead {
  const next = db.leads.update(leadId, { exit: { reason, at: now.toISOString(), note } });
  audit(db, actor, { action: "lead.exit", resourceType: "lead", resourceId: leadId, leadId, detail: { reason }, at: now });
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
export function updateIntake(db: Db, actor: Actor, leadId: string, update: IntakeUpdate, now = new Date()): Lead {
  const lead = db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  assertCan(canOnLead(actor, "edit_intake", lead, db.assignments.list((a) => a.leadId === leadId), now));
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
  const next = db.leads.update(leadId, { intake, conflictCard, urgent, offerSummary: offerSummary({ ...lead, urgent }), intakeOwnerId: lead.intakeOwnerId ?? actor.userId });
  audit(db, actor, { action: "intake.update", resourceType: "lead", resourceId: leadId, leadId, detail: { fields: Object.keys(update) }, at: now });
  return next;
}

/**
 * Records the result of the firm's conflict check. Under the in-firm structure the
 * firm runs its own conflict database against the card; this stores the answer.
 */
export function recordConflictCheck(db: Db, actor: Actor, leadId: string, result: "clear" | "conflict", now = new Date()): Lead {
  const lead = db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  assertCan(actor.role === "platform_admin" || actor.role === "intake" || actor.role === "firm_admin", "Only intake or firm admins record conflict checks");
  const next = db.leads.update(leadId, { conflictCard: { ...lead.conflictCard, clearance: result } });
  audit(db, actor, { action: "conflict.check", resourceType: "lead", resourceId: leadId, leadId, detail: { result }, at: now });
  if (result === "conflict") exitLead(db, actor, leadId, "conflict", undefined, now);
  else if (lead.stage === "qualified" || lead.stage === "contacted" || lead.stage === "new") setStage(db, actor, leadId, "conflict_check", now);
  return db.leads.get(leadId) ?? next;
}
