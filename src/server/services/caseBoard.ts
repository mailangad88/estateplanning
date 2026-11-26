/**
 * The case board (/admin/cases): every accepted case the viewer may see, laid out by where it is in the
 * lead-to-close journey (src/lib/caseJourney.ts), plus the two writes the board makes: assigning a
 * paralegal and ticking off a journey step.
 *
 * Rows come from visibleLeads, so leadAccess decides who sees what: a platform admin sees every case,
 * a firm admin their firm's, an attorney their own, and a paralegal only the cases assigned to them.
 * Offer-stage cards (no accepted attorney yet) stay on /admin/pipeline and the intake queue.
 */
import { buildJourney, CASE_PHASES, JOURNEY_STEPS, lastLegalStep, nextActionLabel, nextStep, STAGE_AFTER_LEGAL, type CasePhase, type Journey } from "@/lib/caseJourney";
import { audit } from "@/server/audit/log";
import { assertCan, can, canOnLead, ForbiddenError, requireMfa } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { visibleLeads } from "@/server/portal/caseView";
import { MATTER_LABELS, setStage } from "@/server/services/leads";
import type { Actor, Assignment, CaseStepKey, Lead, User } from "@/server/types";

export interface CaseCard {
  leadId: string;
  /** "Taylor R." */
  name: string;
  matter: string;
  state: string;
  urgent: boolean;
  lawyerId?: string;
  lawyerName?: string;
  paralegalId?: string;
  paralegalName?: string;
  journey: Journey;
  nextAction: string;
  /** Mine: assigned to the viewer (as paralegal) or the viewer's own case (as attorney) */
  mine: boolean;
}

export interface CaseBoardFilters {
  lawyerId?: string;
  /** a users.id, or "none" for cases without a paralegal */
  paralegalId?: string;
  /** only cases stuck past their step's time limit */
  stuck?: boolean;
  /** include closed and exited cases */
  showClosed?: boolean;
}

export interface CaseBoard {
  columns: { key: CasePhase; label: string; tone: string; cards: CaseCard[] }[];
  exited: CaseCard[];
  counts: { total: number; active: number; stuck: number; closed: number; unassigned: number };
  lawyers: { id: string; name: string }[];
  paralegals: { id: string; name: string }[];
}

export const shortName = (first?: string, last?: string) => [first, last ? `${last[0]}.` : ""].filter(Boolean).join(" ") || "Client";

const ACCEPTED = (lead: Lead) => !!lead.assignedLawyerId;

async function staffNames(db: Db): Promise<Map<string, User>> {
  return new Map((await db.users.list((u) => u.role !== "client")).map((u) => [u.id, u]));
}

export async function caseBoard(db: Db, actor: Actor, filters: CaseBoardFilters = {}, now = new Date()): Promise<CaseBoard> {
  requireMfa(actor);
  assertCan(can(actor, "view_case_board"), "The case board is for the case team");
  const visible = (await visibleLeads(db, actor, now)).filter((x) => x.access === "full" && ACCEPTED(x.lead));
  const lawyers = new Map((await db.lawyers.list()).map((l) => [l.id, l]));
  const users = await staffNames(db);

  const cards: CaseCard[] = [];
  for (const { lead } of visible) {
    const person = await db.persons.get(lead.personId);
    const journey = buildJourney(lead, now);
    const lawyer = lead.assignedLawyerId ? lawyers.get(lead.assignedLawyerId) : undefined;
    const para = lead.assignedParalegalId ? users.get(lead.assignedParalegalId) : undefined;
    cards.push({
      leadId: lead.id,
      name: shortName(person?.firstName, person?.lastName),
      matter: MATTER_LABELS[lead.matterType],
      state: lead.state,
      urgent: lead.urgent,
      lawyerId: lawyer?.id,
      lawyerName: lawyer?.name,
      paralegalId: lead.assignedParalegalId,
      paralegalName: para?.name ?? (lead.assignedParalegalId ? "Paralegal" : undefined),
      journey,
      nextAction: nextActionLabel(journey),
      mine: actor.role === "paralegal" ? lead.assignedParalegalId === actor.userId : actor.role === "attorney" ? lead.assignedLawyerId === actor.lawyerId : false,
    });
  }

  const lawyerOptions = [...new Map(cards.filter((c) => c.lawyerId).map((c) => [c.lawyerId!, c.lawyerName ?? c.lawyerId!]))].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const paralegalOptions = [...new Map(cards.filter((c) => c.paralegalId).map((c) => [c.paralegalId!, c.paralegalName ?? c.paralegalId!]))].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  const filtered = cards.filter((c) =>
    (!filters.lawyerId || c.lawyerId === filters.lawyerId) &&
    (!filters.paralegalId || (filters.paralegalId === "none" ? !c.paralegalId : c.paralegalId === filters.paralegalId)) &&
    (!filters.stuck || c.journey.stale),
  );
  // Most stuck first, then furthest along, so the cards that need someone sit on top.
  const order = (a: CaseCard, b: CaseCard) => Number(b.urgent) - Number(a.urgent) || Number(b.journey.stale) - Number(a.journey.stale) || b.journey.daysInStep - a.journey.daysInStep;
  // Accepted cases rarely sit in the lead phase, so that column shows only when something is in it.
  const columns = CASE_PHASES.filter((p) => (p.key !== "closed" || filters.showClosed) && (p.key !== "lead" || filtered.some((c) => c.journey.phase === "lead"))).map((p) => ({
    key: p.key as CasePhase,
    label: p.label,
    tone: p.tone as string,
    cards: filtered.filter((c) => c.journey.phase === p.key).sort(order),
  }));
  const exited = filters.showClosed ? filtered.filter((c) => c.journey.phase === "exited") : [];
  const active = cards.filter((c) => !c.journey.closed && !c.journey.exited);
  await audit(db, actor, { action: "case_board.view", resourceType: "case_board", resourceId: actor.firmId ?? "all", detail: { cases: filtered.length }, at: now });
  return {
    columns,
    exited,
    counts: {
      total: cards.length,
      active: active.length,
      stuck: active.filter((c) => c.journey.stale).length,
      closed: cards.filter((c) => c.journey.closed).length,
      unassigned: active.filter((c) => !c.paralegalId).length,
    },
    lawyers: lawyerOptions,
    paralegals: paralegalOptions,
  };
}

export interface CaseJourneyView {
  card: CaseCard;
  lead: Lead;
  /** The step the viewer can tick off now, if any */
  canComplete?: { key: string; label: string; skippable: boolean };
  /** The last legal step, which the viewer can undo */
  canUndo?: { key: string; label: string };
  canAssign: boolean;
  /** Paralegals of the case's firm, for the picker */
  paralegalChoices: { id: string; name: string; supportsAttorney: boolean }[];
  /** Who ticked each step off */
  people: Record<string, string>;
}

async function loadLead(db: Db, leadId: string): Promise<{ lead: Lead; assignments: Assignment[] }> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new ForbiddenError();
  return { lead, assignments: await db.assignments.list(undefined, { leadId }) };
}

function stepAllowed(actor: Actor, key: string): boolean {
  const def = JOURNEY_STEPS.find((s) => s.key === key);
  return !!def && (!def.attorneyOnly || actor.role === "attorney" || actor.role === "platform_admin");
}

export async function caseJourney(db: Db, actor: Actor, leadId: string, now = new Date()): Promise<CaseJourneyView> {
  requireMfa(actor);
  assertCan(can(actor, "view_case_board"), "The case board is for the case team");
  const { lead, assignments } = await loadLead(db, leadId);
  assertCan(canOnLead(actor, "view", lead, assignments, now) && ACCEPTED(lead));
  const journey = buildJourney(lead, now);
  const users = await staffNames(db);
  const lawyer = lead.assignedLawyerId ? await db.lawyers.get(lead.assignedLawyerId) : undefined;
  const person = await db.persons.get(lead.personId);
  const para = lead.assignedParalegalId ? users.get(lead.assignedParalegalId) : undefined;
  const card: CaseCard = {
    leadId: lead.id,
    name: shortName(person?.firstName, person?.lastName),
    matter: MATTER_LABELS[lead.matterType],
    state: lead.state,
    urgent: lead.urgent,
    lawyerId: lawyer?.id,
    lawyerName: lawyer?.name,
    paralegalId: lead.assignedParalegalId,
    paralegalName: para?.name,
    journey,
    nextAction: nextActionLabel(journey),
    mine: lead.assignedParalegalId === actor.userId || (!!actor.lawyerId && lead.assignedLawyerId === actor.lawyerId),
  };
  const mayUpdate = canOnLead(actor, "update_case_steps", lead, assignments, now) && !lead.exit;
  const next = nextStep(journey);
  const last = lastLegalStep(journey, lead);
  const canAssign = canOnLead(actor, "assign_paralegal", lead, assignments, now);
  const paralegalChoices = canAssign
    ? [...users.values()]
        .filter((u) => u.role === "paralegal" && u.active && u.firmId === lead.firmId)
        .map((u) => ({ id: u.id, name: u.name, supportsAttorney: !!lead.assignedLawyerId && !!u.supportsLawyerIds?.includes(lead.assignedLawyerId) }))
        .sort((a, b) => Number(b.supportsAttorney) - Number(a.supportsAttorney) || a.name.localeCompare(b.name))
    : [];
  const people: Record<string, string> = {};
  for (const s of journey.steps) if (s.by) people[s.by] = users.get(s.by)?.name ?? (s.by === "system" ? "Automatic" : "Staff");
  for (const h of lead.stageHistory) if (!people[h.by]) people[h.by] = users.get(h.by)?.name ?? (h.by === "system" ? "Automatic" : "Staff");
  await audit(db, actor, { action: "case_journey.view", resourceType: "lead", resourceId: lead.id, leadId: lead.id, at: now });
  return {
    card,
    lead,
    canComplete: mayUpdate && next && stepAllowed(actor, next.key) ? { key: next.key, label: next.label, skippable: !!next.skippable } : undefined,
    canUndo: mayUpdate && last && last.key !== "closed" && stepAllowed(actor, last.key) ? { key: last.key, label: last.label } : undefined,
    canAssign,
    paralegalChoices,
    people,
  };
}

/** Pick (or clear, with null) the paralegal who works the case. They must be an active paralegal at the case's firm. */
export async function assignParalegal(db: Db, actor: Actor, leadId: string, paralegalUserId: string | null, now = new Date()): Promise<Lead> {
  requireMfa(actor);
  const { lead, assignments } = await loadLead(db, leadId);
  assertCan(canOnLead(actor, "assign_paralegal", lead, assignments, now), "Only the case's attorney or firm admin can assign a paralegal");
  if (paralegalUserId) {
    const user = await db.users.get(paralegalUserId);
    if (!user || user.role !== "paralegal" || !user.active) throw new Error("Pick an active paralegal");
    if (user.firmId !== lead.firmId) throw new Error("That paralegal works at another firm");
  }
  if ((lead.assignedParalegalId ?? null) === paralegalUserId) return lead;
  const next = await db.leads.update(lead.id, { assignedParalegalId: paralegalUserId ?? undefined });
  await audit(db, actor, {
    action: "case.paralegal",
    resourceType: "lead",
    resourceId: lead.id,
    leadId: lead.id,
    detail: { from: lead.assignedParalegalId ?? null, to: paralegalUserId },
    at: now,
  });
  return next;
}

export type StepAction = "done" | "skip" | "undo";

/**
 * Tick off the step the case is on (or mark it not needed, where allowed), or undo the last legal step.
 * Steps go in order. A pipeline step moves the lead's stage; some legal steps do too (STAGE_AFTER_LEGAL).
 */
export async function updateCaseStep(db: Db, actor: Actor, leadId: string, stepKey: string, action: StepAction, note?: string, now = new Date()): Promise<Lead> {
  requireMfa(actor);
  const { lead, assignments } = await loadLead(db, leadId);
  assertCan(canOnLead(actor, "update_case_steps", lead, assignments, now), "Only the case team can update this case");
  if (lead.exit) throw new Error("This case was closed early. Reopen it before moving it on.");
  const def = JOURNEY_STEPS.find((s) => s.key === stepKey);
  if (!def) throw new Error("Unknown step");
  if (!stepAllowed(actor, stepKey)) throw new ForbiddenError("Only the attorney can sign off this step");
  const journey = buildJourney(lead, now);
  const trimmed = note?.trim().slice(0, 500) || undefined;

  if (action === "undo") {
    const last = lastLegalStep(journey, lead);
    if (!last || last.key !== stepKey || !def.legal) throw new Error("Only the most recent step can be undone");
    if (def.legal === "closed") throw new Error("A closed case is reopened from the case page, not undone here");
    const steps = { ...lead.caseSteps };
    delete steps[def.legal];
    const next = await db.leads.update(lead.id, { caseSteps: steps });
    await audit(db, actor, { action: "case.step", resourceType: "lead", resourceId: lead.id, leadId: lead.id, detail: { step: stepKey, action }, at: now });
    return next;
  }

  const current = nextStep(journey);
  if (!current || current.key !== stepKey) throw new Error(`This case is on "${journey.current?.label ?? "closed"}". Finish that step first.`);
  if (action === "skip" && !def.skippable) throw new Error("This step cannot be skipped");

  let next = lead;
  if (def.doneAtStage) {
    next = await setStage(db, actor, lead.id, def.doneAtStage, now);
  } else if (def.legal) {
    const key: CaseStepKey = def.legal;
    next = await db.leads.update(lead.id, {
      caseSteps: { ...lead.caseSteps, [key]: { status: action === "skip" ? "skipped" : "done", at: now.toISOString(), by: actor.userId, note: trimmed } },
    });
    const stage = STAGE_AFTER_LEGAL[key];
    if (stage) next = await setStage(db, actor, lead.id, stage, now);
  }
  await audit(db, actor, { action: "case.step", resourceType: "lead", resourceId: lead.id, leadId: lead.id, detail: { step: stepKey, action }, at: now });
  return next;
}
