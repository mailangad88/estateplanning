/**
 * Paralegal commission on a case: how much, on what fee, and whether it is pending, earned or paid.
 *
 * The rule is set per case (a percent of the fee, or a flat amount). A case without its own rule uses
 * the firm default below. The commission is "pending" while the case is open, "earned" once the file is
 * closed, and "paid" when the office records the payout. Nothing here moves money.
 *
 * Internal tracking only. Before paying anyone from it, Sargun confirms the plan fits Illinois Rule 5.4
 * (a nonlawyer may share in a compensation plan, not in the fee of a particular case) and Rule 7.2(b)
 * (nothing of value for recommending or bringing in a client).
 *
 * Pure: the page, the API and tests share it.
 */
import type { CommissionRecord, Lead } from "@/server/types";

/** Firm default until Angad sets the real one. Per-case rules override it. */
export const DEFAULT_COMMISSION: { mode: "percent" | "flat"; percent: number; flatCents: number } = {
  mode: "percent",
  percent: 10,
  flatCents: 25_000,
};

/** Package prices from the pricing page (Basic $2,500, second tier $3,500), used when no retainer fee is on file. */
const PACKAGE_FEE_CENTS: Record<string, number> = { "Basic ($2,500)": 250_000, "Second tier ($3,500)": 350_000 };

export type CommissionStatus = "pending" | "earned" | "paid";

export interface CommissionLine {
  mode: "percent" | "flat";
  /** Whole percent, e.g. 10 */
  percent?: number;
  /** The fee the percent is taken from, when known */
  feeCents?: number;
  /** Where the fee came from */
  feeSource: "retainer" | "package" | "none";
  amountCents: number;
  status: CommissionStatus;
  /** True when the case uses the firm default rather than its own rule */
  isDefault: boolean;
  paidAt?: string;
  paidBy?: string;
  note?: string;
}

export function packageFeeCents(packageAnswer?: string): number | undefined {
  return packageAnswer ? PACKAGE_FEE_CENTS[packageAnswer] : undefined;
}

/**
 * The commission on a case. `retainerFeeCents` is the fee on the newest live engagement, if any; the
 * questionnaire's package answer is the fallback.
 */
export function commissionFor(
  lead: Pick<Lead, "commission" | "stage" | "questionnaire" | "exit">,
  retainerFeeCents?: number,
): CommissionLine {
  const rule: Partial<CommissionRecord> = lead.commission ?? {};
  const isDefault = !lead.commission?.mode;
  const mode = rule.mode ?? DEFAULT_COMMISSION.mode;
  const fromPackage = packageFeeCents(lead.questionnaire?.answers.package);
  const feeCents = retainerFeeCents ?? fromPackage;
  const feeSource = retainerFeeCents !== undefined ? "retainer" : fromPackage !== undefined ? "package" : "none";
  let amountCents: number;
  let percent: number | undefined;
  if (mode === "flat") {
    amountCents = rule.flatCents ?? DEFAULT_COMMISSION.flatCents;
  } else {
    percent = rule.percent ?? DEFAULT_COMMISSION.percent;
    amountCents = feeCents ? Math.round((feeCents * percent) / 100) : 0;
  }
  // A case that ended early earns nothing unless the office recorded a payout already.
  if (lead.exit && !rule.paidAt) amountCents = 0;
  const closed = lead.stage === "plan_complete" || lead.stage === "annual_review";
  const status: CommissionStatus = rule.paidAt ? "paid" : closed ? "earned" : "pending";
  return {
    mode,
    percent,
    feeCents,
    feeSource,
    amountCents: rule.paidAt && rule.paidCents !== undefined ? rule.paidCents : amountCents,
    status,
    isDefault,
    paidAt: rule.paidAt,
    paidBy: rule.paidBy,
    note: rule.note,
  };
}

export const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 });
