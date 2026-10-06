/**
 * Funnel analytics for marketing, firm admins and platform admins. Returns
 * aggregates only: no client names, contact details or case facts. Lawyer names
 * appear in the offer table because lawyers are staff, not clients.
 *
 * Small cells: any per-source or per-tool row with fewer than MIN_CELL leads
 * reports its counts but null for every rate. Rates over a handful of leads are
 * statistical noise, and on a tiny row they can single out one person's outcome
 * (privacy). Totals are never suppressed.
 */
import { assertCan, can, ForbiddenError } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { STAGES, type Actor, type Lead, type Stage } from "@/server/types";

export const MIN_CELL = 5;
const MIN = 60_000;
const OUTBOUND = ["call", "sms", "email"];

export interface FunnelOptions {
  from: Date;
  to: Date;
  firmId?: string;
}

const median = (xs: number[]) => percentile(xs, 50);
export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}
const rate = (n: number, d: number) => (d > 0 ? n / d : null);

function reached(lead: Lead): Set<Stage> {
  const set = new Set<Stage>(lead.stageHistory.map((h) => h.stage));
  set.add(lead.stage);
  return set;
}

export interface SourceRow {
  source: string;
  campaign: string;
  leads: number;
  qualified: number;
  consultsBooked: number;
  retainersSigned: number;
  paid: number;
  /** Null when the row has fewer than MIN_CELL leads */
  qualifiedRate: number | null;
  signedRate: number | null;
}

export interface ToolRow {
  tool: string;
  leads: number;
  signed: number;
  signedRate: number | null;
}

export interface LawyerOfferRow {
  lawyerId: string;
  lawyerName: string;
  offered: number;
  accepted: number;
  declined: number;
  expired: number;
  medianAcceptMinutes: number | null;
  slaMetRate: number | null;
}

export interface FunnelReport {
  period: { from: string; to: string; firmId?: string };
  totalLeads: number;
  stages: { stage: Stage; reached: number; stepConversion: number | null }[];
  exits: Record<string, number>;
  bySource: SourceRow[];
  roi: {
    adSpendCents: number | null;
    revenueCents: number;
    costPerLeadCents: number | null;
    costPerSignedClientCents: number | null;
  };
  byTool: ToolRow[];
  speedToLead: { contacted: number; uncontacted: number; medianMinutes: number | null; p90Minutes: number | null; within5MinRate: number | null };
  offers: {
    total: number;
    medianAcceptMinutes: number | null;
    slaMetRate: number | null;
    timeouts: number;
    declinesByReason: Record<string, number>;
    perLawyer: LawyerOfferRow[];
  };
  consults: { held: number; noShow: number; showRate: number | null; signedAfterConsultRate: number | null };
}

export async function funnelReport(db: Db, actor: Actor, opts: FunnelOptions): Promise<FunnelReport> {
  assertCan(can(actor, "view_reports"));
  let firmId = opts.firmId;
  if (actor.role === "firm_admin") {
    if (!actor.firmId) throw new ForbiddenError();
    firmId = actor.firmId;
  }
  const from = opts.from.getTime();
  const to = opts.to.getTime();
  const inPeriod = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= from && t < to;
  };

  const leads = await db.leads.list((l) => inPeriod(l.createdAt) && (!firmId || l.firmId === firmId));
  const leadIds = new Set(leads.map((l) => l.id));
  const reachedBy = new Map(leads.map((l) => [l.id, reached(l)]));
  const did = (l: Lead, s: Stage) => reachedBy.get(l.id)!.has(s);

  const counts = STAGES.map((s) => leads.filter((l) => did(l, s)).length);
  const stages = STAGES.map((stage, i) => ({ stage, reached: counts[i], stepConversion: i === 0 ? null : rate(counts[i], counts[i - 1]) }));

  const exits: Record<string, number> = {};
  for (const l of leads) if (l.exit) exits[l.exit.reason] = (exits[l.exit.reason] ?? 0) + 1;

  const group = <K extends string>(keyOf: (l: Lead) => K) => {
    const m = new Map<K, Lead[]>();
    for (const l of leads) m.set(keyOf(l), [...(m.get(keyOf(l)) ?? []), l]);
    return m;
  };

  const bySource: SourceRow[] = [];
  const sources = new Map<string, { source: string; campaign: string; leads: Lead[] }>();
  for (const l of leads) {
    const source = l.source.utmSource || "direct";
    const campaign = l.source.utmCampaign || "none";
    const k = `${source}\u0000${campaign}`;
    const g = sources.get(k) ?? { source, campaign, leads: [] };
    g.leads.push(l);
    sources.set(k, g);
  }
  for (const g of sources.values()) {
    const n = g.leads.length;
    const c = (s: Stage) => g.leads.filter((l) => did(l, s)).length;
    const small = n < MIN_CELL;
    bySource.push({
      source: g.source,
      campaign: g.campaign,
      leads: n,
      qualified: c("qualified"),
      consultsBooked: c("consult_booked"),
      retainersSigned: c("retainer_signed"),
      paid: c("paid"),
      qualifiedRate: small ? null : c("qualified") / n,
      signedRate: small ? null : c("retainer_signed") / n,
    });
  }
  bySource.sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source));

  const byTool: ToolRow[] = [...group((l) => l.capture?.tool ?? "unknown")].map(([tool, ls]) => {
    const signed = ls.filter((l) => did(l, "retainer_signed")).length;
    return { tool, leads: ls.length, signed, signedRate: ls.length < MIN_CELL ? null : signed / ls.length };
  }).sort((a, b) => b.leads - a.leads);

  // ROI: spend and collected fees recorded as billable events; analytics only, never billing.
  const firmLawyerIds = firmId ? new Set((await db.lawyers.list((l) => l.firmId === firmId)).map((l) => l.id)) : null;
  const events = await db.billableEvents.list((e) => inPeriod(e.occurredAt));
  const revenueCents = events
    .filter((e) => e.type === "fee_collected" && (!firmLawyerIds || (e.lawyerId && firmLawyerIds.has(e.lawyerId))))
    .reduce((s, e) => s + (e.amountCents ?? 0), 0);
  const spendEvents = events.filter((e) => e.type === "ad_spend_posted");
  // Ad spend is a platform cost with no firm attached, so firm-scoped reports omit it.
  const adSpendCents = firmId || !spendEvents.length ? null : spendEvents.reduce((s, e) => s + (e.amountCents ?? 0), 0);
  const signedTotal = counts[STAGES.indexOf("retainer_signed")];
  const roi = {
    adSpendCents,
    revenueCents,
    costPerLeadCents: adSpendCents !== null && leads.length ? Math.round(adSpendCents / leads.length) : null,
    costPerSignedClientCents: adSpendCents !== null && signedTotal ? Math.round(adSpendCents / signedTotal) : null,
  };

  // Speed to lead: first outbound call/sms/email, or the "contacted" stage, whichever is first.
  const activities = await db.activities.list((a) => leadIds.has(a.leadId) && a.direction === "outbound" && OUTBOUND.includes(a.kind));
  const firstOut = new Map<string, number>();
  for (const a of activities) {
    const t = new Date(a.at).getTime();
    firstOut.set(a.leadId, Math.min(t, firstOut.get(a.leadId) ?? Infinity));
  }
  const waits: number[] = [];
  for (const l of leads) {
    const created = new Date(l.createdAt).getTime();
    const times = [firstOut.get(l.id), ...l.stageHistory.filter((h) => h.stage === "contacted").map((h) => new Date(h.at).getTime())].filter((t): t is number => t !== undefined && t >= created);
    if (times.length) waits.push((Math.min(...times) - created) / MIN);
  }
  const speedToLead = {
    contacted: waits.length,
    uncontacted: leads.length - waits.length,
    medianMinutes: median(waits),
    p90Minutes: percentile(waits, 90),
    within5MinRate: rate(waits.filter((w) => w <= 5).length, waits.length),
  };

  const assignments = await db.assignments.list((a) => leadIds.has(a.leadId) && (!firmId || a.firmId === firmId));
  const acceptMins = assignments.filter((a) => a.status === "accepted" && a.respondedAt).map((a) => (new Date(a.respondedAt!).getTime() - new Date(a.offeredAt).getTime()) / MIN);
  const judged = assignments.filter((a) => a.slaMet !== undefined);
  const declinesByReason: Record<string, number> = {};
  for (const a of assignments) if (a.status === "declined") declinesByReason[a.declineReason ?? "other"] = (declinesByReason[a.declineReason ?? "other"] ?? 0) + 1;
  const lawyers = new Map((await db.lawyers.list()).map((l) => [l.id, l.name]));
  const perLawyer: LawyerOfferRow[] = [];
  for (const id of new Set(assignments.map((a) => a.lawyerId))) {
    const mine = assignments.filter((a) => a.lawyerId === id);
    const j = mine.filter((a) => a.slaMet !== undefined);
    perLawyer.push({
      lawyerId: id,
      lawyerName: lawyers.get(id) ?? id,
      offered: mine.length,
      accepted: mine.filter((a) => a.status === "accepted").length,
      declined: mine.filter((a) => a.status === "declined").length,
      expired: mine.filter((a) => a.status === "expired").length,
      medianAcceptMinutes: median(mine.filter((a) => a.status === "accepted" && a.respondedAt).map((a) => (new Date(a.respondedAt!).getTime() - new Date(a.offeredAt).getTime()) / MIN)),
      slaMetRate: rate(j.filter((a) => a.slaMet).length, j.length),
    });
  }
  perLawyer.sort((a, b) => a.lawyerName.localeCompare(b.lawyerName));
  const offers = {
    total: assignments.length,
    medianAcceptMinutes: median(acceptMins),
    slaMetRate: rate(judged.filter((a) => a.slaMet).length, judged.length),
    timeouts: assignments.filter((a) => a.status === "expired").length,
    declinesByReason,
    perLawyer,
  };

  const consults = await db.consults.list((c) => leadIds.has(c.leadId));
  const held = consults.filter((c) => c.status === "held").length;
  const noShow = consults.filter((c) => c.status === "no_show").length;
  const heldLeads = new Set(consults.filter((c) => c.status === "held").map((c) => c.leadId));
  const signedAfter = leads.filter((l) => heldLeads.has(l.id) && did(l, "retainer_signed")).length;

  return {
    period: { from: opts.from.toISOString(), to: opts.to.toISOString(), firmId },
    totalLeads: leads.length,
    stages,
    exits,
    bySource,
    roi,
    byTool,
    speedToLead,
    offers,
    consults: { held, noShow, showRate: rate(held, held + noShow), signedAfterConsultRate: rate(signedAfter, heldLeads.size) },
  };
}
