/**
 * Paralegal commissions (/admin/commissions and the panel on each case): the per-case rule, totals per
 * paralegal, and the office's payout record. Rows come from visibleLeads, so a paralegal only ever sees
 * the cases assigned to them, and so only their own commission. See src/lib/commission.ts for the maths
 * and the ethics note.
 */
import { commissionFor, money, type CommissionLine, type CommissionStatus } from "@/lib/commission";
import { audit } from "@/server/audit/log";
import { assertCan, can, canOnLead, ForbiddenError, requireMfa } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { visibleLeads } from "@/server/portal/caseView";
import { shortName } from "@/server/services/caseBoard";
import type { Actor, CommissionRecord, Engagement, Lead } from "@/server/types";

/** The agreed fee: the newest engagement that was not withdrawn (package total when it has one). */
export function retainerFee(engagements: Engagement[]): number | undefined {
  const live = engagements.filter((e) => e.status !== "voided" && e.status !== "draft");
  if (!live.length) return undefined;
  const newest = [...live].sort((a, b) => (b.history[0]?.at ?? "").localeCompare(a.history[0]?.at ?? ""))[0];
  return newest.packageSelection?.totalCents ?? newest.feeCents;
}

export interface CommissionRow {
  leadId: string;
  name: string;
  paralegalId: string;
  paralegalName: string;
  lawyerName?: string;
  line: CommissionLine;
  closedAt?: string;
}

export interface ParalegalTotals {
  paralegalId: string;
  name: string;
  cases: number;
  pendingCents: number;
  earnedCents: number;
  paidCents: number;
}

export interface CommissionReport {
  rows: CommissionRow[];
  totals: ParalegalTotals[];
  all: { pendingCents: number; earnedCents: number; paidCents: number; cases: number };
}

function owner(lead: Lead): string | undefined {
  return lead.commission?.paidTo ?? lead.assignedParalegalId;
}

export async function commissionReport(db: Db, actor: Actor, filters: { paralegalId?: string; status?: CommissionStatus } = {}, now = new Date()): Promise<CommissionReport> {
  requireMfa(actor);
  assertCan(can(actor, "view_commissions"), "Commissions are for the case team");
  const visible = (await visibleLeads(db, actor, now)).filter((x) => x.access === "full" && x.lead.assignedLawyerId && owner(x.lead));
  const users = new Map((await db.users.list((u) => u.role !== "client")).map((u) => [u.id, u]));
  const lawyers = new Map((await db.lawyers.list()).map((l) => [l.id, l]));
  const rows: CommissionRow[] = [];
  for (const { lead } of visible) {
    const paralegalId = owner(lead)!;
    // A paralegal sees only their own commission, even on a case paid out before it was reassigned to them.
    if (actor.role === "paralegal" && paralegalId !== actor.userId) continue;
    const person = await db.persons.get(lead.personId);
    const engagements = await db.engagements.list(undefined, { leadId: lead.id });
    rows.push({
      leadId: lead.id,
      name: shortName(person?.firstName, person?.lastName),
      paralegalId,
      paralegalName: users.get(paralegalId)?.name ?? "Paralegal",
      lawyerName: lead.assignedLawyerId ? lawyers.get(lead.assignedLawyerId)?.name : undefined,
      line: commissionFor(lead, retainerFee(engagements)),
      closedAt: lead.stageHistory.find((h) => h.stage === "plan_complete")?.at,
    });
  }
  const shown = rows
    .filter((r) => (!filters.paralegalId || r.paralegalId === filters.paralegalId) && (!filters.status || r.line.status === filters.status))
    .sort((a, b) => ({ earned: 0, pending: 1, paid: 2 })[a.line.status] - ({ earned: 0, pending: 1, paid: 2 })[b.line.status] || b.line.amountCents - a.line.amountCents);
  const byPara = new Map<string, ParalegalTotals>();
  for (const r of rows) {
    const t = byPara.get(r.paralegalId) ?? { paralegalId: r.paralegalId, name: r.paralegalName, cases: 0, pendingCents: 0, earnedCents: 0, paidCents: 0 };
    t.cases += 1;
    t[`${r.line.status}Cents` as "pendingCents" | "earnedCents" | "paidCents"] += r.line.amountCents;
    byPara.set(r.paralegalId, t);
  }
  const totals = [...byPara.values()].sort((a, b) => b.earnedCents + b.pendingCents + b.paidCents - (a.earnedCents + a.pendingCents + a.paidCents));
  const sum = (k: "pendingCents" | "earnedCents" | "paidCents") => totals.reduce((n, t) => n + t[k], 0);
  await audit(db, actor, { action: "commissions.view", resourceType: "commissions", resourceId: actor.firmId ?? "all", detail: { rows: shown.length }, at: now });
  return { rows: shown, totals, all: { pendingCents: sum("pendingCents"), earnedCents: sum("earnedCents"), paidCents: sum("paidCents"), cases: rows.length } };
}

async function load(db: Db, leadId: string) {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new ForbiddenError();
  return { lead, assignments: await db.assignments.list(undefined, { leadId }) };
}

/** The commission on one case, for the case page. `undefined` when the viewer may not see it. */
export async function caseCommission(db: Db, actor: Actor, leadId: string, now = new Date()) {
  const { lead, assignments } = await load(db, leadId);
  if (!can(actor, "view_commissions") || !canOnLead(actor, "view", lead, assignments, now)) return undefined;
  if (actor.role === "paralegal" && owner(lead) !== actor.userId) return undefined;
  const line = commissionFor(lead, retainerFee(await db.engagements.list(undefined, { leadId })));
  return {
    line,
    hasParalegal: !!owner(lead),
    canManage: canOnLead(actor, "manage_commission", lead, assignments, now) && !lead.commission?.paidAt,
    canPay: canOnLead(actor, "pay_commission", lead, assignments, now) && !!owner(lead),
  };
}

/** Set (or clear back to the firm default, with mode "default") the case's commission rule. */
export async function setCommissionRule(
  db: Db,
  actor: Actor,
  leadId: string,
  input: { mode: "percent" | "flat" | "default"; percent?: number; flatCents?: number; note?: string },
  now = new Date(),
): Promise<Lead> {
  requireMfa(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "manage_commission", lead, assignments, now), "Only the case's attorney or the office sets commission");
  if (lead.commission?.paidAt) throw new Error("This commission is already paid. Undo the payout first.");
  let rule: CommissionRecord;
  if (input.mode === "default") {
    rule = {};
  } else if (input.mode === "percent") {
    const p = Number(input.percent);
    if (!Number.isFinite(p) || p < 0 || p > 50) throw new Error("Enter a percent between 0 and 50");
    rule = { mode: "percent", percent: Math.round(p * 100) / 100 };
  } else if (input.mode === "flat") {
    const c = Math.round(Number(input.flatCents));
    if (!Number.isFinite(c) || c < 0 || c > 1_000_000) throw new Error("Enter an amount between $0 and $10,000");
    rule = { mode: "flat", flatCents: c };
  } else {
    throw new Error("mode must be percent, flat or default");
  }
  const note = input.note?.trim().slice(0, 500);
  const next = await db.leads.update(lead.id, { commission: { ...rule, ...(note ? { note } : {}), setAt: now.toISOString(), setBy: actor.userId } });
  await audit(db, actor, { action: "commission.rule", resourceType: "lead", resourceId: lead.id, leadId: lead.id, detail: { mode: input.mode, percent: rule.percent ?? null, flatCents: rule.flatCents ?? null }, at: now });
  return next;
}

/** The office records that the earned commission was paid (or, with undo, takes that record back). */
export async function markCommissionPaid(db: Db, actor: Actor, leadId: string, undo = false, now = new Date()): Promise<Lead> {
  requireMfa(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "pay_commission", lead, assignments, now), "Only the office records commission payouts");
  const cur = lead.commission ?? {};
  if (undo) {
    if (!cur.paidAt) throw new Error("Nothing to undo");
    const { paidAt: _a, paidBy: _b, paidCents: _c, paidTo: _d, ...rest } = cur;
    const next = await db.leads.update(lead.id, { commission: rest });
    await audit(db, actor, { action: "commission.unpaid", resourceType: "lead", resourceId: lead.id, leadId: lead.id, at: now });
    return next;
  }
  const line = commissionFor(lead, retainerFee(await db.engagements.list(undefined, { leadId })));
  if (line.status !== "earned") throw new Error(line.status === "paid" ? "Already paid" : "Commission is earned when the file is closed");
  if (!lead.assignedParalegalId) throw new Error("No paralegal on this case");
  if (line.amountCents <= 0) throw new Error("There is no commission to pay on this case");
  const next = await db.leads.update(lead.id, {
    commission: { ...cur, paidAt: now.toISOString(), paidBy: actor.userId, paidCents: line.amountCents, paidTo: lead.assignedParalegalId },
  });
  await audit(db, actor, { action: "commission.paid", resourceType: "lead", resourceId: lead.id, leadId: lead.id, detail: { cents: line.amountCents, to: lead.assignedParalegalId }, at: now });
  return next;
}

/** CSV for payroll: one row per case. Office only. */
export async function commissionCsv(db: Db, actor: Actor, now = new Date()): Promise<string> {
  assertCan(actor.role === "platform_admin" || actor.role === "firm_admin", "The payroll export is for the office");
  const report = await commissionReport(db, actor, {}, now);
  // Quote fields with commas or quotes, and defuse spreadsheet formulas in names.
  const esc = (raw: string) => {
    const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
  };
  const lines = [["case", "client", "paralegal", "attorney", "rule", "fee", "commission", "status", "closed", "paid"].join(",")];
  for (const r of report.rows) {
    const rule = r.line.mode === "flat" ? "flat" : `${r.line.percent}%`;
    lines.push([r.leadId, r.name, r.paralegalName, r.lawyerName ?? "", rule, r.line.feeCents ? money(r.line.feeCents) : "", money(r.line.amountCents), r.line.status, r.closedAt?.slice(0, 10) ?? "", r.line.paidAt?.slice(0, 10) ?? ""].map(esc).join(","));
  }
  await audit(db, actor, { action: "commissions.export", resourceType: "commissions", resourceId: actor.firmId ?? "all", detail: { rows: report.rows.length }, at: now });
  return lines.join("\n") + "\n";
}
