import { describe, expect, it } from "vitest";
import { checkRule, computeCharges, type BillableEvent, type FeeRule } from "@/lib/fees";
import { feeRules } from "@/config/fees";

const fiftyPercent: FeeRule = { id: "pct", feeType: "percent_of_fee", percent: 50, effectiveFrom: "2026-01-01" };

describe("checkRule", () => {
  it("blocks percent-of-fee for a marketing company even with counsel approval", () => {
    expect(checkRule({ ...fiftyPercent, counselApprovedAt: "2026-02-01" }, "marketing_services").allowed).toBe(false);
  });

  it("locks percent-of-fee for a certified referral service until counsel approval is recorded", () => {
    expect(checkRule(fiftyPercent, "certified_lrs").allowed).toBe(false);
    expect(checkRule({ ...fiftyPercent, counselApprovedAt: "2026-02-01" }, "certified_lrs").allowed).toBe(true);
  });

  it("allows flat per-lead fees for a marketing company", () => {
    expect(checkRule({ id: "l", feeType: "per_lead", amountCents: 5000, effectiveFrom: "2026-01-01" }, "marketing_services").allowed).toBe(true);
  });

  it("rejects a percent outside 0 to 100", () => {
    expect(checkRule({ ...fiftyPercent, percent: 150, counselApprovedAt: "2026-02-01" }, "abs").allowed).toBe(false);
  });

  it("invoices nothing under the launch structure", () => {
    const events: BillableEvent[] = [{ id: "e1", type: "fee_collected", occurredAt: "2026-03-01T10:00:00Z", amountCents: 300000 }];
    const result = computeCharges(events, feeRules, "in_firm");
    expect(result.totalCents).toBe(0);
    expect(result.blockedRules.map((b) => b.ruleId)).toContain("percent-of-fee");
  });
});

describe("computeCharges", () => {
  const events: BillableEvent[] = [
    { id: "l1", type: "lead_delivered", occurredAt: "2026-03-01T10:00:00Z", state: "TX" },
    { id: "l2", type: "lead_delivered", occurredAt: "2026-03-02T10:00:00Z", state: "TX" },
    { id: "l3", type: "lead_delivered", occurredAt: "2026-03-03T10:00:00Z", state: "CA" },
    { id: "s1", type: "ad_spend_posted", occurredAt: "2026-03-05T10:00:00Z", amountCents: 100000 },
  ];

  it("prices matching events, respects state filters, and adds the management fee to spend", () => {
    const rules: FeeRule[] = [
      { id: "tx-lead", feeType: "per_lead", amountCents: 7500, state: "TX", effectiveFrom: "2026-01-01" },
      { id: "spend", feeType: "ad_spend_passthrough", percent: 15, effectiveFrom: "2026-01-01" },
    ];
    const result = computeCharges(events, rules, "marketing_services");
    expect(result.lines).toHaveLength(3);
    expect(result.totalCents).toBe(7500 * 2 + 115000);
  });

  it("applies caps per rule", () => {
    const rules: FeeRule[] = [{ id: "lead", feeType: "per_lead", amountCents: 7500, capCents: 10000, effectiveFrom: "2026-01-01" }];
    const result = computeCharges(events, rules, "marketing_services");
    expect(result.totalCents).toBe(10000);
  });

  it("ignores rules outside their effective dates", () => {
    const rules: FeeRule[] = [{ id: "lead", feeType: "per_lead", amountCents: 7500, effectiveFrom: "2026-03-02", effectiveTo: "2026-03-03" }];
    const result = computeCharges(events, rules, "marketing_services");
    expect(result.lines.map((l) => l.eventId)).toEqual(["l2"]);
  });

  it("uses the editable rate once a percent rule is permitted", () => {
    const fee: BillableEvent[] = [{ id: "f", type: "fee_collected", occurredAt: "2026-03-01T10:00:00Z", amountCents: 400000 }];
    const result = computeCharges(fee, [{ ...fiftyPercent, percent: 20, counselApprovedAt: "2026-02-01" }], "certified_lrs");
    expect(result.totalCents).toBe(80000);
  });
});
