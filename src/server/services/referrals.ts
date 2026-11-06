/**
 * Referrals: the attorney holding a lead (by default the primary intake attorney, who takes every
 * incoming lead first) passes it to someone else, and every hand-off is logged with who, when, why
 * and how it turned out.
 *
 * - To a platform attorney: the holder's offer or case is withdrawn and the new attorney gets an offer.
 *   The outcome is read off that offer and the lead's later stages, so nobody keeps it up by hand.
 * - To an attorney outside the platform: the lead leaves the pipeline (exit "referred_out") and the
 *   referrer records the outcome when they hear back.
 *
 * There is deliberately no fee or payment anywhere in here. Nothing of value may be tied to a referral
 * until the Illinois Rule 5.4 / 7.2 review is done.
 */
import { randomUUID } from "node:crypto";
import { audit } from "@/server/audit/log";
import { assertCan, can, canOnLead, ForbiddenError, leadAccess } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { hardFilter } from "@/server/routing/engine";
import { loadInput } from "@/server/services/routing";
import {
  REFERRAL_OUTCOMES,
  REFERRAL_REASONS,
  STAGES,
  type Actor,
  type Assignment,
  type Lawyer,
  type Lead,
  type LeadReferral,
  type ReferralOutcome,
  type ReferralReason,
  type Stage,
} from "@/server/types";

export const REASON_LABELS: Record<ReferralReason, string> = {
  conflict: "Conflict of interest",
  capacity: "No capacity",
  practice_area: "Outside practice area",
  location: "Location or licence",
  language: "Language",
  client_request: "Client asked for someone else",
  other: "Other",
};

export const OUTCOME_LABELS: Record<ReferralOutcome, string> = {
  pending: "Waiting to hear",
  accepted: "Accepted",
  booked: "Consult booked",
  retained: "Retained",
  declined: "Declined",
  no_response: "No response",
};

/** Outcomes the referrer can record by hand for an outside referral. */
export const MANUAL_OUTCOMES: ReferralOutcome[] = REFERRAL_OUTCOMES;

export type ReferralTarget =
  | { kind: "platform"; lawyerId: string }
  | { kind: "outside"; name: string; firm?: string; contact?: string };

export interface ReferInput {
  target: ReferralTarget;
  reason: ReferralReason;
  note?: string;
  clientAgreed: boolean;
}

const clean = (s: string | undefined, max: number) => {
  const v = s?.trim().slice(0, max);
  return v ? v : undefined;
};

/** Who holds the lead right now: the accepted attorney, else the attorney with an open offer. */
function holderOf(lead: Lead, assignments: Assignment[], now: Date): Assignment | undefined {
  const mine = assignments.filter((a) => a.leadId === lead.id);
  if (lead.assignedLawyerId) return mine.find((a) => a.status === "accepted" && a.lawyerId === lead.assignedLawyerId);
  return mine.find((a) => a.status === "offered" && new Date(a.expiresAt) > now);
}

/** Platform attorneys this lead could go to, with the reason each one can't take it. */
export async function referralTargets(db: Db, actor: Actor, leadId: string, now = new Date()): Promise<{ lawyerId: string; name: string; blockedBy?: string }[]> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error(`lead not found: ${leadId}`);
  const assignments = await db.assignments.list(undefined, { leadId });
  if (!canOnLead(actor, "refer_lead", lead, assignments, now)) throw new ForbiddenError();
  const holder = holderOf(lead, assignments, now);
  const input = await loadInput(db, lead, now);
  return input.lawyers
    .filter((l) => l.id !== holder?.lawyerId)
    .map((l) => ({ lawyerId: l.id, name: l.name, blockedBy: targetBlock(l, lead, holder, input) }))
    .sort((a, b) => Number(!!a.blockedBy) - Number(!!b.blockedBy) || a.name.localeCompare(b.name));
}

function targetBlock(l: Lawyer, lead: Lead, holder: Assignment | undefined, input: Awaited<ReturnType<typeof loadInput>>): string | undefined {
  // A conflict binds the whole firm that found it, not an attorney at another firm.
  const otherFirm = !!holder && l.firmId !== holder.firmId;
  const why = hardFilter(l, otherFirm ? { ...input, lead: { ...lead, conflictCard: { ...lead.conflictCard, clearance: "pending" } } } : input);
  return why;
}

export async function referLead(db: Db, actor: Actor, leadId: string, input: ReferInput, now = new Date()): Promise<LeadReferral> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error(`lead not found: ${leadId}`);
  const assignments = await db.assignments.list(undefined, { leadId });
  if (!canOnLead(actor, "refer_lead", lead, assignments, now)) throw new ForbiddenError("You can't refer this lead");
  if (lead.exit) throw new Error("This lead has already left the pipeline");
  if (STAGES.indexOf(lead.stage) >= STAGES.indexOf("retainer_signed")) throw new Error("The retainer is already signed");
  if (!REFERRAL_REASONS.includes(input.reason)) throw new Error("Choose why you are referring this lead");
  if (input.clientAgreed !== true) throw new Error("Confirm the client agreed to their details going to this attorney");
  const holder = holderOf(lead, assignments, now);
  if (!holder) throw new Error("No attorney holds this lead yet, so there is nothing to refer");
  if (actor.role === "attorney" && actor.lawyerId !== holder.lawyerId) throw new ForbiddenError("Only the attorney holding this lead can refer it");
  if (actor.role === "firm_admin" && actor.firmId !== holder.firmId) throw new ForbiddenError();
  const note = clean(input.note, 1000);

  const base = {
    id: randomUUID(),
    leadId,
    fromLawyerId: holder.lawyerId,
    fromFirmId: holder.firmId,
    reason: input.reason,
    note,
    clientAgreed: true as const,
    referredAt: now.toISOString(),
    referredBy: actor.userId,
    outcome: "pending" as const,
  };
  const from = await db.lawyers.get(holder.lawyerId);
  const reasonText = REASON_LABELS[input.reason].toLowerCase();

  if (input.target.kind === "platform") {
    const to = await db.lawyers.get(input.target.lawyerId);
    if (!to) throw new Error("Choose an attorney");
    if (to.id === holder.lawyerId) throw new Error("Choose someone other than the attorney holding the lead");
    const block = targetBlock(to, lead, holder, await loadInput(db, lead, now));
    if (block) throw new Error(`${to.name} can't take this lead: ${block}`);

    await db.assignments.update(holder.id, { status: "withdrawn", respondedAt: holder.respondedAt ?? now.toISOString(), note: `Referred to ${to.name}` });
    const offer = await db.assignments.insert({
      id: randomUUID(),
      leadId,
      lawyerId: to.id,
      firmId: to.firmId,
      offeredAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + to.acceptSlaMinutes * 60_000).toISOString(),
      status: "offered",
      routingReason: `Referred by ${from?.name ?? holder.lawyerId}: ${reasonText}`,
    });
    await db.leads.update(leadId, {
      assignedLawyerId: undefined,
      firmId: undefined,
      stage: "offered",
      stageHistory: [...lead.stageHistory, { stage: "offered", at: now.toISOString(), by: actor.userId }],
    });
    const referral = await db.leadReferrals.insert({ ...base, toLawyerId: to.id, toFirmId: to.firmId, assignmentId: offer.id });
    await db.activities.insert({ id: randomUUID(), leadId, kind: "system", at: now.toISOString(), summary: `${from?.name ?? "The attorney"} referred this lead to ${to.name} (${reasonText}).`, byUserId: actor.userId });
    await audit(db, actor, { action: "referral.sent", resourceType: "lead_referral", resourceId: referral.id, leadId, at: now, detail: { to: "platform", toLawyerId: to.id, reason: input.reason, assignmentId: offer.id } });
    return referral;
  }

  // Outside the platform the referrer hands over the client's details, so they must see the whole case.
  if (leadAccess(actor, lead, assignments, now) !== "full") throw new ForbiddenError("Accept the lead before referring it outside the platform");
  const name = clean(input.target.name, 200);
  if (!name) throw new Error("Enter the attorney's name");
  await db.assignments.update(holder.id, { status: "withdrawn", respondedAt: holder.respondedAt ?? now.toISOString(), note: `Referred outside to ${name}` });
  await db.leads.update(leadId, { exit: { reason: "referred_out", at: now.toISOString(), note: `Referred to ${name}` } });
  const referral = await db.leadReferrals.insert({
    ...base,
    outsideName: name,
    outsideFirm: clean(input.target.firm, 200),
    outsideContact: clean(input.target.contact, 200),
  });
  await db.activities.insert({ id: randomUUID(), leadId, kind: "system", at: now.toISOString(), summary: `${from?.name ?? "The attorney"} referred this lead to ${name}, outside the platform (${reasonText}).`, byUserId: actor.userId });
  await audit(db, actor, { action: "referral.sent", resourceType: "lead_referral", resourceId: referral.id, leadId, at: now, detail: { to: "outside", reason: input.reason } });
  return referral;
}

function canManageReferral(actor: Actor, r: LeadReferral): boolean {
  if (actor.role === "platform_admin") return true;
  if (actor.role === "firm_admin") return actor.firmId === r.fromFirmId;
  if (actor.role === "attorney") return actor.lawyerId === r.fromLawyerId;
  return false;
}

function canSeeReferral(actor: Actor, r: LeadReferral): boolean {
  if (actor.role === "platform_admin") return true;
  if (actor.role === "firm_admin") return !!actor.firmId && (actor.firmId === r.fromFirmId || actor.firmId === r.toFirmId);
  if (actor.role === "attorney") return !!actor.lawyerId && (actor.lawyerId === r.fromLawyerId || actor.lawyerId === r.toLawyerId);
  return false;
}

/** Outside referrals only: platform referrals follow the offer and the lead on their own. */
export async function recordOutcome(db: Db, actor: Actor, referralId: string, outcome: ReferralOutcome, note?: string, now = new Date()): Promise<LeadReferral> {
  const r = await db.leadReferrals.get(referralId);
  if (!r || !canSeeReferral(actor, r)) throw new Error("Referral not found");
  if (!canManageReferral(actor, r)) throw new ForbiddenError("Only the referring attorney or their office can update this");
  if (r.toLawyerId) throw new Error("This referral updates itself as the attorney responds");
  if (!MANUAL_OUTCOMES.includes(outcome)) throw new Error("Choose an outcome");
  const updated = await db.leadReferrals.update(r.id, { outcome, outcomeAt: now.toISOString(), outcomeBy: actor.userId, outcomeNote: clean(note, 500) });
  await audit(db, actor, { action: "referral.outcome", resourceType: "lead_referral", resourceId: r.id, leadId: r.leadId, at: now, detail: { outcome } });
  return updated;
}

/** Where a platform referral stands, from the receiving attorney's offer and the lead's stages since. */
export function effectiveOutcome(r: LeadReferral, offer: Assignment | undefined, lead: Lead | undefined): ReferralOutcome {
  if (!r.toLawyerId) return r.outcome;
  if (!offer) return "pending";
  switch (offer.status) {
    case "offered":
      return "pending";
    case "expired":
      return "no_response";
    case "declined":
      return "declined";
    case "withdrawn":
    case "accepted": {
      if (offer.status === "withdrawn" && !offer.respondedAt) return "declined";
      const since = (s: Stage) => !!lead?.stageHistory.some((h) => h.stage === s && h.at >= r.referredAt);
      if (since("retainer_signed") || since("paid")) return "retained";
      if (since("consult_booked") || since("consult_held")) return "booked";
      return "accepted";
    }
  }
}

export interface ReferralRow extends LeadReferral {
  fromName: string;
  toName: string;
  effective: ReferralOutcome;
  canUpdate: boolean;
}

async function toRows(db: Db, actor: Actor, refs: LeadReferral[]): Promise<ReferralRow[]> {
  const lawyers = new Map((await db.lawyers.list()).map((l) => [l.id, l.name]));
  const offers = new Map<string, Assignment>();
  const leads = new Map<string, Lead>();
  for (const r of refs) {
    if (r.assignmentId && !offers.has(r.assignmentId)) {
      const a = await db.assignments.get(r.assignmentId);
      if (a) offers.set(a.id, a);
    }
    if (r.toLawyerId && !leads.has(r.leadId)) {
      const l = await db.leads.get(r.leadId);
      if (l) leads.set(l.id, l);
    }
  }
  return refs.map((r) => ({
    ...r,
    fromName: lawyers.get(r.fromLawyerId) ?? r.fromLawyerId,
    toName: r.toLawyerId ? lawyers.get(r.toLawyerId) ?? r.toLawyerId : `${r.outsideName}${r.outsideFirm ? `, ${r.outsideFirm}` : ""}`,
    effective: effectiveOutcome(r, r.assignmentId ? offers.get(r.assignmentId) : undefined, leads.get(r.leadId)),
    canUpdate: !r.toLawyerId && canManageReferral(actor, r),
  }));
}

/** The referral log on one lead, oldest first. */
export async function referralsForLead(db: Db, actor: Actor, leadId: string): Promise<ReferralRow[]> {
  const refs = (await db.leadReferrals.list((r) => canSeeReferral(actor, r), { leadId })).sort((a, b) => a.referredAt.localeCompare(b.referredAt));
  return toRows(db, actor, refs);
}

export interface ReferralReport {
  period: { from: string; to: string };
  primary?: { lawyerId: string; name: string };
  /** Leads created in the period that reached an attorney */
  routed: number;
  handledByPrimary: number;
  referredByPrimary: number;
  /** Declined, timed out or routed by the client's own choice without a logged referral */
  wentElsewhere: number;
  byMonth: { month: string; handled: number; referred: number; elsewhere: number }[];
  byRecipient: { name: string; outside: boolean; total: number; outcomes: Record<ReferralOutcome, number> }[];
  byReferrer: { name: string; total: number }[];
  byReason: { reason: ReferralReason; label: string; total: number }[];
  outcomes: { outcome: ReferralOutcome; label: string; total: number }[];
  rows: ReferralRow[];
}

const zeroOutcomes = () => Object.fromEntries(REFERRAL_OUTCOMES.map((o) => [o, 0])) as Record<ReferralOutcome, number>;

export async function referralReport(db: Db, actor: Actor, opts: { from: Date; to: Date }): Promise<ReferralReport> {
  assertCan(can(actor, "view_referrals"));
  if (actor.role === "firm_admin" && !actor.firmId) throw new ForbiddenError();
  const from = opts.from.getTime();
  const to = opts.to.getTime();
  const inPeriod = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= from && t < to;
  };
  const lawyers = await db.lawyers.list();
  const primary = lawyers.find((l) => l.primaryIntake);
  const firmScope = actor.role === "firm_admin" ? actor.firmId : undefined;

  const refs = (await db.leadReferrals.list((r) => inPeriod(r.referredAt) && canSeeReferral(actor, r))).sort((a, b) => b.referredAt.localeCompare(a.referredAt));
  const rows = await toRows(db, actor, refs);

  // Who handled each lead created in the period: primary kept it, primary referred it, or it went elsewhere.
  const leads = await db.leads.list((l) => inPeriod(l.createdAt));
  const allAssignments = await db.assignments.list((a) => leads.some((l) => l.id === a.leadId));
  const allRefs = await db.leadReferrals.list((r) => leads.some((l) => l.id === r.leadId));
  const months = new Map<string, { handled: number; referred: number; elsewhere: number }>();
  let routed = 0, handled = 0, referred = 0, elsewhere = 0;
  for (const l of leads) {
    const mine = allAssignments.filter((a) => a.leadId === l.id);
    if (!mine.length) continue;
    if (firmScope && !mine.some((a) => a.firmId === firmScope)) continue;
    routed++;
    const m = l.createdAt.slice(0, 7);
    const row = months.get(m) ?? { handled: 0, referred: 0, elsewhere: 0 };
    const refByPrimary = !!primary && allRefs.some((r) => r.leadId === l.id && r.fromLawyerId === primary.id);
    const primaryKept = !!primary && l.assignedLawyerId === primary.id;
    if (refByPrimary) { referred++; row.referred++; }
    else if (primaryKept) { handled++; row.handled++; }
    else { elsewhere++; row.elsewhere++; }
    months.set(m, row);
  }
  const byMonth = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));

  const recipients = new Map<string, ReferralReport["byRecipient"][number]>();
  const referrers = new Map<string, number>();
  const reasons = new Map<ReferralReason, number>();
  const outcomes = zeroOutcomes();
  for (const r of rows) {
    const key = r.toLawyerId ?? `outside:${r.toName.toLowerCase()}`;
    const g = recipients.get(key) ?? { name: r.toName, outside: !r.toLawyerId, total: 0, outcomes: zeroOutcomes() };
    g.total++;
    g.outcomes[r.effective]++;
    recipients.set(key, g);
    referrers.set(r.fromName, (referrers.get(r.fromName) ?? 0) + 1);
    reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
    outcomes[r.effective]++;
  }

  return {
    period: { from: opts.from.toISOString(), to: opts.to.toISOString() },
    primary: primary ? { lawyerId: primary.id, name: primary.name } : undefined,
    routed,
    handledByPrimary: handled,
    referredByPrimary: referred,
    wentElsewhere: elsewhere,
    byMonth,
    byRecipient: [...recipients.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    byReferrer: [...referrers].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    byReason: REFERRAL_REASONS.map((reason) => ({ reason, label: REASON_LABELS[reason], total: reasons.get(reason) ?? 0 })).filter((r) => r.total > 0).sort((a, b) => b.total - a.total),
    outcomes: REFERRAL_OUTCOMES.map((outcome) => ({ outcome, label: OUTCOME_LABELS[outcome], total: outcomes[outcome] })),
    rows,
  };
}
