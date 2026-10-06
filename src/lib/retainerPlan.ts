/**
 * Retainer pricing and payment-plan math. Pure functions, all amounts in integer cents.
 *
 * Plans never include interest or a financing charge: the schedule always adds up to exactly
 * the fee. Rounding: each installment is the floor of an even split and the remainder goes on
 * the LAST installment, so the schedule never overshoots and no cent is lost.
 *
 * The fee here is the firm's own flat fee. Nothing in this file touches the platform fee
 * engine (src/lib/fees.ts); a plan is how the client pays the firm, not a platform charge.
 */

export type PackageTierId = "essentials" | "complete" | "legacy";

export interface SelectedAddOn {
  id: string;
  name: string;
  priceCents: number;
}

/** What the client is buying, with the attorney's prices. */
export interface PackageSelection {
  tierId: PackageTierId;
  tierName: string;
  /** Attorney-set price of the package for this engagement */
  tierPriceCents: number;
  addOns: SelectedAddOn[];
  totalCents: number;
}

export type InstallmentKind = "full" | "deposit" | "installment";
/** "due" covers both not-yet-due and due-now; "late" is set by the sweep after the grace period. */
export type InstallmentStatus = "due" | "paid" | "late";

export interface Installment {
  n: number;
  kind: InstallmentKind;
  amountCents: number;
  /** Set when the retainer is signed (see activateSchedule) */
  dueOn?: string;
  status: InstallmentStatus;
  paymentId?: string;
  paidAt?: string;
}

export interface PaymentPlan {
  mode: "full" | "plan";
  totalCents: number;
  /** Which account the firm's config directed payments to when the plan was made */
  account: "operating" | "trust";
  installments: Installment[];
  /** Set once the retainer is signed and due dates are fixed */
  activatedAt?: string;
}

export interface PlanLimits {
  enabled: boolean;
  maxInstallments: number;
  minDepositPercent: number;
  minInstallmentCents: number;
  minTotalCents: number;
  lateGraceDays: number;
}

export type PlanInput =
  | { mode: "full" }
  | { mode: "plan"; depositCents: number; installments: number };

const isCents = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;

export function priceSelection(input: {
  tierId: PackageTierId;
  tierName: string;
  tierPriceCents: number;
  addOns?: SelectedAddOn[];
}): PackageSelection {
  if (!isCents(input.tierPriceCents)) throw new Error("package price must be a positive whole number of cents");
  const addOns = input.addOns ?? [];
  const seen = new Set<string>();
  for (const a of addOns) {
    if (!isCents(a.priceCents)) throw new Error(`add-on price must be a positive whole number of cents: ${a.id}`);
    if (seen.has(a.id)) throw new Error(`add-on listed twice: ${a.id}`);
    seen.add(a.id);
  }
  const totalCents = input.tierPriceCents + addOns.reduce((s, a) => s + a.priceCents, 0);
  if (!Number.isSafeInteger(totalCents)) throw new Error("total is too large");
  return { tierId: input.tierId, tierName: input.tierName, tierPriceCents: input.tierPriceCents, addOns, totalCents };
}

/** Splits `restCents` into `n` installments: floor each, remainder on the last. */
export function splitInstallments(restCents: number, n: number): number[] {
  const base = Math.floor(restCents / n);
  const out = Array<number>(n).fill(base);
  out[n - 1] = restCents - base * (n - 1);
  return out;
}

export function buildPlan(totalCents: number, input: PlanInput, limits: PlanLimits, account: "operating" | "trust"): PaymentPlan {
  if (!isCents(totalCents)) throw new Error("total must be a positive whole number of cents");
  if (input.mode === "full") {
    return { mode: "full", totalCents, account, installments: [{ n: 1, kind: "full", amountCents: totalCents, status: "due" }] };
  }
  if (!limits.enabled) throw new Error("payment plans are not offered");
  if (totalCents < limits.minTotalCents) throw new Error("this fee is below the minimum for a payment plan");
  const { depositCents, installments: count } = input;
  if (!Number.isInteger(count) || count < 1 || count > limits.maxInstallments) {
    throw new Error(`a plan has 1 to ${limits.maxInstallments} installments after the deposit`);
  }
  if (!isCents(depositCents) || depositCents >= totalCents) throw new Error("the deposit must be more than zero and less than the total");
  if (depositCents * 100 < totalCents * limits.minDepositPercent) {
    throw new Error(`the deposit must be at least ${limits.minDepositPercent}% of the total`);
  }
  const parts = splitInstallments(totalCents - depositCents, count);
  if (Math.min(...parts) < limits.minInstallmentCents) throw new Error("installments are below the minimum amount");
  return {
    mode: "plan",
    totalCents,
    account,
    installments: [
      { n: 1, kind: "deposit", amountCents: depositCents, status: "due" },
      ...parts.map((amountCents, i): Installment => ({ n: i + 2, kind: "installment", amountCents, status: "due" })),
    ],
  };
}

/** Adds whole months to a YYYY-MM-DD date, clamping to the end of a shorter month (Jan 31 + 1 = Feb 28). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** Fixes due dates once the retainer is signed: deposit (or full payment) that day, then one installment a month. */
export function activateSchedule(plan: PaymentPlan, signedAtIso: string): PaymentPlan {
  if (plan.activatedAt) return plan;
  const day = signedAtIso.slice(0, 10);
  return {
    ...plan,
    activatedAt: signedAtIso,
    installments: plan.installments.map((i, idx) => ({ ...i, dueOn: addMonths(day, idx) })),
  };
}

/** True when an unpaid installment is past its due date plus the grace days. */
export function isLate(i: Installment, now: Date, graceDays: number): boolean {
  if (i.status === "paid" || !i.dueOn) return false;
  return now.toISOString().slice(0, 10) > addDays(i.dueOn, graceDays);
}

export interface PaymentRow {
  installmentNo?: number;
  amountCents: number;
  status: "pending" | "paid" | "failed";
  refunds: { amountCents: number }[];
}

export interface PaymentStatusSummary {
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
  state: "no_plan" | "unpaid" | "partial" | "paid" | "late";
  lateCount: number;
  nextDue?: { n: number; amountCents: number; dueOn?: string };
}

export function summarizePayments(plan: PaymentPlan | undefined, payments: PaymentRow[]): PaymentStatusSummary {
  if (!plan) return { totalCents: 0, paidCents: 0, refundedCents: 0, balanceCents: 0, state: "no_plan", lateCount: 0 };
  const paidCents = plan.installments.filter((i) => i.status === "paid").reduce((s, i) => s + i.amountCents, 0);
  const refundedCents = payments.reduce((s, p) => s + p.refunds.reduce((t, r) => t + r.amountCents, 0), 0);
  const unpaid = plan.installments.filter((i) => i.status !== "paid");
  const lateCount = unpaid.filter((i) => i.status === "late").length;
  const next = unpaid[0];
  return {
    totalCents: plan.totalCents,
    paidCents,
    refundedCents,
    balanceCents: plan.totalCents - paidCents,
    state: unpaid.length === 0 ? "paid" : lateCount > 0 ? "late" : paidCents > 0 ? "partial" : "unpaid",
    lateCount,
    nextDue: next ? { n: next.n, amountCents: next.amountCents, dueOn: next.dueOn } : undefined,
  };
}

export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

/**
 * Plain-language summary an attorney can read to or send the client. States the total, what is in it,
 * how it is paid, and where the money goes. Never mentions interest because there is none.
 */
export function clientSummary(selection: PackageSelection, plan: PaymentPlan): { headline: string; lines: string[] } {
  const lines: string[] = [`${selection.tierName} package: ${money(selection.tierPriceCents)}`];
  for (const a of selection.addOns) lines.push(`Add-on, ${a.name}: ${money(a.priceCents)}`);
  lines.push(`Total flat fee: ${money(plan.totalCents)}`);
  if (plan.mode === "full") {
    lines.push(`Payment: ${money(plan.totalCents)} in one payment when you sign.`);
  } else {
    const [dep, ...rest] = plan.installments;
    const when = (i: Installment) => (i.dueOn ? `due ${i.dueOn}` : "");
    lines.push(`Payment plan: ${money(dep.amountCents)} deposit when you sign${dep.dueOn ? ` (${when(dep)})` : ""}, then ${rest.length} monthly payment${rest.length === 1 ? "" : "s"}.`);
    const first = rest[0].amountCents;
    const last = rest[rest.length - 1].amountCents;
    lines.push(
      last === first || rest.length === 1
        ? `Each monthly payment is ${money(first)}${rest[0].dueOn ? `, the first ${when(rest[0])}` : ""}.`
        : `Monthly payments are ${money(first)} each, with the last one ${money(last)} so the total comes out exact${rest[0].dueOn ? `; the first is ${when(rest[0])}` : ""}.`,
    );
    lines.push("There is no interest and no added fee for paying in installments.");
  }
  lines.push(
    plan.account === "trust"
      ? "Payments go into the firm's client trust account and are moved to the firm as the work is done. Anything not yet earned is refunded if the engagement ends early."
      : "Payments go to the firm's operating account as earned on receipt. If the engagement ends early, any unearned part is refunded as the rules of professional conduct require.",
  );
  return { headline: `${money(plan.totalCents)} flat fee`, lines };
}
