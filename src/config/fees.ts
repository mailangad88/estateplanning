import type { FeeRule } from "@/lib/fees";

/**
 * Editable fee rules. Under the launch structure ("in_firm") none of these invoice
 * anything; they are kept so switching structures only needs counsel approval and
 * a date, not code changes. The 50% rule from the original idea is kept here with
 * its rate editable, but the engine refuses it unless the structure permits it.
 */
export const feeRules: FeeRule[] = [
  { id: "retainer-monthly", feeType: "monthly_retainer", amountCents: 0, effectiveFrom: "2026-01-01" },
  { id: "per-qualified-lead", feeType: "per_lead", amountCents: 0, effectiveFrom: "2026-01-01" },
  { id: "ad-spend", feeType: "ad_spend_passthrough", percent: 15, effectiveFrom: "2026-01-01" },
  { id: "percent-of-fee", feeType: "percent_of_fee", percent: 50, effectiveFrom: "2026-01-01" },
];
