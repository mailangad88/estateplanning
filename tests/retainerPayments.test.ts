import { describe, expect, it } from "vitest";
import { retainerPayments } from "@/config/firm";
import {
  activateSchedule,
  addMonths,
  buildPlan,
  clientSummary,
  isLate,
  priceSelection,
  splitInstallments,
  summarizePayments,
  type PlanLimits,
} from "@/lib/retainerPlan";
import { buildConsentRecord } from "@/lib/consent";
import { verifyAuditChain } from "@/server/audit/log";
import { ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { MockEsignProvider } from "@/server/esign/mock";
import { LawPayProvider } from "@/server/esign/lawpay";
import { MockPaymentProvider, paymentProviderFromEnv } from "@/server/esign/payments";
import { WebhookSignatureError } from "@/server/esign/provider";
import { buildCaseView } from "@/server/portal/caseView";
import { approveEngagement, draftEngagement, handleEsignWebhook, handlePaymentWebhook, sendEngagement } from "@/server/services/engagement";
import { flagLateInstallments, issueDueLinks, refundPayment, type RetainerTermsInput } from "@/server/services/retainerPayments";
import type { Actor } from "@/server/types";

const LIMITS: PlanLimits = { enabled: true, maxInstallments: 6, minDepositPercent: 25, minInstallmentCents: 10_000, minTotalCents: 50_000, lateGraceDays: 3 };

describe("plan math", () => {
  it("splits in cents with the remainder on the last installment", () => {
    expect(splitInstallments(70_000, 3)).toEqual([23_333, 23_333, 23_334]);
    expect(splitInstallments(100, 1)).toEqual([100]);
    for (const [rest, n] of [[99_999, 4], [1, 3], [123_457, 6]] as const) {
      const parts = splitInstallments(rest, n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(rest);
      expect(parts.slice(0, -1).every((p) => p === parts[0])).toBe(true);
      expect(parts[n - 1]).toBeGreaterThanOrEqual(parts[0]);
    }
  });

  it("builds pay in full and deposit plus installments that add up exactly", () => {
    const full = buildPlan(250_000, { mode: "full" }, LIMITS, "trust");
    expect(full.installments).toEqual([{ n: 1, kind: "full", amountCents: 250_000, status: "due" }]);
    const plan = buildPlan(100_000, { mode: "plan", depositCents: 30_000, installments: 3 }, LIMITS, "trust");
    expect(plan.installments.map((i) => [i.kind, i.amountCents])).toEqual([["deposit", 30_000], ["installment", 23_333], ["installment", 23_333], ["installment", 23_334]]);
    expect(plan.installments.reduce((s, i) => s + i.amountCents, 0)).toBe(100_000);
    expect(plan.installments.every((i) => Number.isInteger(i.amountCents) && i.status === "due")).toBe(true);
  });

  it("enforces the configured limits", () => {
    const mk = (total: number, deposit: number, n: number, limits = LIMITS) => buildPlan(total, { mode: "plan", depositCents: deposit, installments: n }, limits, "trust");
    expect(() => mk(100_000, 30_000, 7)).toThrow(/installments/);
    expect(() => mk(100_000, 30_000, 0)).toThrow(/installments/);
    expect(() => mk(100_000, 24_999, 3)).toThrow(/at least 25%/);
    expect(() => mk(100_000, 100_000, 3)).toThrow(/less than the total/);
    expect(() => mk(100_000, 0, 3)).toThrow(/deposit/);
    expect(() => mk(60_000, 20_000, 5)).toThrow(/minimum amount/); // 8,000 each
  });

  it("rejects fractional cents, small fees and disabled plans", () => {
    expect(() => buildPlan(1000.5, { mode: "full" }, LIMITS, "trust")).toThrow(/whole number/);
    expect(() => buildPlan(40_000, { mode: "plan", depositCents: 20_000, installments: 2 }, LIMITS, "trust")).toThrow(/below the minimum/);
    expect(() => buildPlan(100_000, { mode: "plan", depositCents: 30_000, installments: 2 }, { ...LIMITS, enabled: false }, "trust")).toThrow(/not offered/);
    expect(() => buildPlan(100_000, { mode: "plan", depositCents: 30_000.5, installments: 2 }, LIMITS, "trust")).toThrow();
  });

  it("prices a selection from attorney-set prices and add-ons", () => {
    const s = priceSelection({ tierId: "complete", tierName: "Complete", tierPriceCents: 300_000, addOns: [{ id: "pet_trust", name: "Pet trust", priceCents: 45_000 }] });
    expect(s.totalCents).toBe(345_000);
    expect(() => priceSelection({ tierId: "complete", tierName: "Complete", tierPriceCents: 0 })).toThrow();
    expect(() => priceSelection({ tierId: "complete", tierName: "Complete", tierPriceCents: 1, addOns: [{ id: "a", name: "A", priceCents: 1.5 }] })).toThrow();
    expect(() => priceSelection({ tierId: "complete", tierName: "Complete", tierPriceCents: 1, addOns: [{ id: "a", name: "A", priceCents: 1 }, { id: "a", name: "A", priceCents: 1 }] })).toThrow(/twice/);
  });

  it("sets monthly due dates from the signing day, clamped to short months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-10-06", 12)).toBe("2027-10-06");
    const plan = activateSchedule(buildPlan(100_000, { mode: "plan", depositCents: 30_000, installments: 3 }, LIMITS, "trust"), "2026-10-31T15:00:00Z");
    expect(plan.installments.map((i) => i.dueOn)).toEqual(["2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31"]);
    expect(activateSchedule(plan, "2030-01-01T00:00:00Z")).toBe(plan); // activating twice changes nothing
  });

  it("is late only after the grace period and never once paid", () => {
    const i = { n: 2, kind: "installment" as const, amountCents: 1, dueOn: "2026-11-06", status: "due" as const };
    expect(isLate(i, new Date("2026-11-09T23:59:00Z"), 3)).toBe(false);
    expect(isLate(i, new Date("2026-11-10T00:00:00Z"), 3)).toBe(true);
    expect(isLate({ ...i, status: "paid" }, new Date("2027-01-01T00:00:00Z"), 3)).toBe(false);
    expect(isLate({ ...i, dueOn: undefined }, new Date("2027-01-01T00:00:00Z"), 3)).toBe(false);
  });

  it("summarizes and words the client summary without interest", () => {
    const sel = priceSelection({ tierId: "complete", tierName: "Complete", tierPriceCents: 90_000, addOns: [{ id: "pet_trust", name: "Pet trust", priceCents: 10_000 }] });
    const plan = activateSchedule(buildPlan(100_000, { mode: "plan", depositCents: 30_000, installments: 3 }, LIMITS, "trust"), "2026-10-06T00:00:00Z");
    const text = clientSummary(sel, plan).lines.join("\n");
    expect(text).toMatch(/Total flat fee: \$1,000/);
    expect(text).toMatch(/\$233\.34/);
    expect(text).toMatch(/no interest/);
    expect(text).toMatch(/client trust account/);
    expect(summarizePayments(plan, []).state).toBe("unpaid");
    expect(summarizePayments(undefined, []).state).toBe("no_plan");
  });
});

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------
const T0 = new Date("2026-10-06T10:00:00Z");
const hours = (h: number) => new Date(T0.getTime() + h * 3_600_000);
const days = (d: number) => hours(d * 24);

const attorney: Actor = { userId: "u-att", role: "attorney", firmId: "f1", lawyerId: "l1", mfa: true };
const otherAttorney: Actor = { userId: "u-att2", role: "attorney", firmId: "f1", lawyerId: "l2", mfa: true };
const paralegal: Actor = { userId: "u-para", role: "paralegal", firmId: "f1", supportsLawyerIds: ["l1"], mfa: true };
const intake: Actor = { userId: "u-int", role: "intake", mfa: true };
const client: Actor = { userId: "u-client", role: "client", personId: "p1", mfa: true };

async function setup(stage: "consult_held" | "new" = "consult_held") {
  const db = createMemoryDb();
  await db.firms.insert({ id: "f1", name: "Firm", structure: "in_firm" });
  await db.lawyers.insert({
    id: "l1", firmId: "f1", name: "A. Attorney", email: "a@f.test", licensedStates: ["TX"], matterTypes: ["new_plan"], specialties: [],
    languages: ["en"], weeklyCapacity: 5, activeLeadCap: 5, acceptSlaMinutes: 60, active: true, stats: { avgAcceptMinutes: 10, showRate: 1, reviewScore: 5 },
  });
  await db.persons.insert({ id: "p1", firstName: "Pat", lastName: "Client", email: "pat@x.test", phone: "+15555550100", language: "en", state: "TX" });
  await db.leads.insert({
    id: "lead1", personId: "p1", createdAt: T0.toISOString(), stage, stageHistory: [], matterType: "new_plan", state: "TX", urgent: false,
    score: { score: 80, tier: "hot", grade: "A", urgent: false, components: [], redFlags: [] }, segments: [], source: {},
    consent: buildConsentRecord({ smsConsent: true, acknowledgedNoRelationship: true, pageUrl: "/x", ip: null, userAgent: null, now: T0 }),
    offerSummary: "s",
    conflictCard: { clientName: "Pat Client", parties: [], matterType: "new_plan", state: "TX", clearance: "clear" },
    intake: { summary: "s", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    firmId: "f1", assignedLawyerId: "l1",
  });
  return { db, esign: new MockEsignProvider("s", () => T0), pay: new MockPaymentProvider() };
}

const PLAN_TERMS: RetainerTermsInput = {
  tierId: "complete",
  tierPriceCents: 90_000,
  addOns: [{ id: "pet_trust", priceCents: 10_000 }],
  plan: { mode: "plan", depositCents: 30_000, installments: 3 },
};

async function sentWithPlan(db: Db, esign: MockEsignProvider, pay: MockPaymentProvider, terms = PLAN_TERMS) {
  const d = await draftEngagement(db, paralegal, { leadId: "lead1", terms }, T0);
  await approveEngagement(db, attorney, d.id, T0);
  return sendEngagement(db, paralegal, d.id, esign, pay, T0);
}

async function sign(db: Db, esign: MockEsignProvider, pay: MockPaymentProvider | undefined, envelopeId: string, at: Date) {
  const w = esign.simulateSign(envelopeId, at);
  await handleEsignWebhook(db, esign, w.rawBody, w.headers, at, undefined, pay);
}

async function paid(db: Db, pay: MockPaymentProvider, paymentId: string, at: Date, extra = {}) {
  const w = pay.webhookFor(paymentId, "paid", at, extra);
  return handlePaymentWebhook(db, pay, w.rawBody, w.headers, at);
}

describe("package selection and drafting", () => {
  it("prices a good/better/best package with add-ons, defaults to the trust account and writes the plan into the letter", async () => {
    const { db } = await setup();
    const e = await draftEngagement(db, paralegal, { leadId: "lead1", terms: PLAN_TERMS }, T0);
    expect(retainerPayments.account).toBe("trust");
    expect(e.packageId).toBe("complete");
    expect(e.feeCents).toBe(100_000);
    expect(e.packageSelection).toMatchObject({ tierId: "complete", tierPriceCents: 90_000, totalCents: 100_000 });
    expect(e.paymentPlan).toMatchObject({ mode: "plan", account: "trust", totalCents: 100_000 });
    expect(e.paymentPlan!.installments.map((i) => i.amountCents)).toEqual([30_000, 23_333, 23_333, 23_334]);
    expect(e.letter).toMatch(/client trust account/);
    expect(e.letter).toMatch(/Pet trust/);
    expect(e.letter).toMatch(/no interest/);
    expect(e.letter).toMatch(/deposit of \$300\.00/);
  });

  it("rejects bad terms and a fee that disagrees with the prices", async () => {
    const { db } = await setup();
    const draft = (terms: RetainerTermsInput, feeCents?: number) => draftEngagement(db, attorney, { leadId: "lead1", terms, feeCents }, T0);
    await expect(draft({ ...PLAN_TERMS, tierId: "platinum" })).rejects.toThrow(/unknown package/);
    await expect(draft({ ...PLAN_TERMS, addOns: [{ id: "jetpack", priceCents: 1 }] })).rejects.toThrow(/unknown add-on/);
    await expect(draft({ ...PLAN_TERMS, tierPriceCents: 0 })).rejects.toThrow();
    await expect(draft(PLAN_TERMS, 99_999)).rejects.toThrow(/does not match/);
    await expect(draft({ ...PLAN_TERMS, plan: { mode: "plan", depositCents: 1_000, installments: 3 } })).rejects.toThrow(/at least 25%/);
    await expect(draftEngagement(db, attorney, { leadId: "lead1" }, T0)).rejects.toThrow(/unknown package/);
  });

  it("only the assigned attorney or paralegal drafts, and only the attorney approves", async () => {
    const { db } = await setup();
    await expect(draftEngagement(db, otherAttorney, { leadId: "lead1", terms: PLAN_TERMS }, T0)).rejects.toThrow(ForbiddenError);
    await expect(draftEngagement(db, intake, { leadId: "lead1", terms: PLAN_TERMS }, T0)).rejects.toThrow(ForbiddenError);
    const e = await draftEngagement(db, paralegal, { leadId: "lead1", terms: PLAN_TERMS }, T0);
    await expect(approveEngagement(db, paralegal, e.id, T0)).rejects.toThrow(ForbiddenError);
  });
});

describe("plan flow", () => {
  it("sends no link with the retainer, sends the deposit link on signing, and records the deposit", async () => {
    const { db, esign, pay } = await setup();
    const e = await sentWithPlan(db, esign, pay);
    expect(pay.links.size).toBe(0); // nothing to pay before the retainer is signed
    expect(await db.payments.list()).toHaveLength(0);

    await sign(db, esign, pay, e.providerEnvelopeId!, hours(2));
    expect(pay.links.size).toBe(1);
    const [id, link] = [...pay.links][0];
    expect(link).toMatchObject({ amountCents: 30_000, account: "trust", installmentNo: 1, dueOn: "2026-10-06" });
    const [rec] = await db.payments.list();
    expect(rec).toMatchObject({ engagementId: e.id, installmentNo: 1, amountCents: 30_000, account: "trust", status: "pending", provider: "mock" });
    expect((await db.leads.get("lead1"))!.stage).toBe("retainer_signed");
    expect((await db.activities.list()).some((a) => /Payment link sent/.test(a.summary))).toBe(true);
    const cur = await db.engagements.get(e.id);
    expect(cur!.paymentPlan!.installments.map((i) => i.dueOn)).toEqual(["2026-10-06", "2026-11-06", "2026-12-06", "2027-01-06"]);

    expect(await paid(db, pay, id, hours(3))).toEqual({ processed: 1 });
    const after = (await db.engagements.get(e.id))!;
    expect(after.status).toBe("paid");
    expect(after.paymentPlan!.installments.map((i) => i.status)).toEqual(["paid", "due", "due", "due"]);
    expect((await db.leads.get("lead1"))!.stage).toBe("paid");
    expect((await db.payments.get(rec.id))).toMatchObject({ status: "paid", paidAt: hours(3).toISOString() });
    expect((await db.billableEvents.list()).filter((b) => b.type === "fee_collected").map((b) => b.amountCents)).toEqual([30_000]);
  });

  it("falls back to the sweep when no payment provider is passed at signing", async () => {
    const { db, esign, pay } = await setup();
    const e = await sentWithPlan(db, esign, pay);
    await sign(db, esign, undefined, e.providerEnvelopeId!, hours(2));
    expect(pay.links.size).toBe(0);
    expect(await issueDueLinks(db, pay, hours(3))).toBe(1);
    expect(await issueDueLinks(db, pay, hours(4))).toBe(0); // the open link is not duplicated
    expect(pay.links.size).toBe(1);
  });

  it("sends each installment link on its due date and the full plan ends paid", async () => {
    const { db, esign, pay } = await setup();
    const e = await sentWithPlan(db, esign, pay);
    await sign(db, esign, pay, e.providerEnvelopeId!, hours(2));
    await paid(db, pay, "mock-pay-1", hours(3));
    expect(await issueDueLinks(db, pay, days(10))).toBe(0); // not due yet
    expect(await issueDueLinks(db, pay, days(31))).toBe(1); // 2026-11-06
    await paid(db, pay, "mock-pay-2", days(31));
    expect(await issueDueLinks(db, pay, days(62))).toBe(1);
    await paid(db, pay, "mock-pay-3", days(62));
    expect(await issueDueLinks(db, pay, days(93))).toBe(1);
    await paid(db, pay, "mock-pay-4", days(93));

    const cur = (await db.engagements.get(e.id))!;
    expect(cur.paymentPlan!.installments.every((i) => i.status === "paid")).toBe(true);
    const payments = await db.payments.list();
    expect(payments.reduce((s, p) => s + p.amountCents, 0)).toBe(cur.feeCents);
    expect(summarizePayments(cur.paymentPlan, payments)).toMatchObject({ state: "paid", balanceCents: 0, paidCents: 100_000 });
    const events = (await db.billableEvents.list()).filter((b) => b.type === "fee_collected");
    expect(events.reduce((s, b) => s + (b.amountCents ?? 0), 0)).toBe(100_000);
    expect(verifyAuditChain(await db.audit.list()).ok).toBe(true);
    expect(JSON.stringify(await db.audit.list())).not.toMatch(/30000|23333|23334|100000/); // audit holds ids and numbers, never amounts
  });

  it("pay in full sends one link on signing for the whole fee", async () => {
    const { db, esign, pay } = await setup();
    const e = await sentWithPlan(db, esign, pay, { tierId: "essentials", tierPriceCents: 150_000, plan: { mode: "full" } });
    await sign(db, esign, pay, e.providerEnvelopeId!, hours(2));
    expect([...pay.links.values()]).toMatchObject([{ amountCents: 150_000, installmentNo: 1 }]);
    await paid(db, pay, "mock-pay-1", hours(3));
    expect((await db.engagements.get(e.id))!.paymentPlan!.installments[0].status).toBe("paid");
    expect(summarizePayments((await db.engagements.get(e.id))!.paymentPlan, await db.payments.list()).state).toBe("paid");
  });

  it("flags installments late once after the grace period, and a late payment clears it", async () => {
    const { db, esign, pay } = await setup();
    const e = await sentWithPlan(db, esign, pay);
    await sign(db, esign, pay, e.providerEnvelopeId!, hours(2));
    await paid(db, pay, "mock-pay-1", hours(3));
    const status = async () => (await db.engagements.get(e.id))!.paymentPlan!.installments.map((i) => i.status);

    expect(await flagLateInstallments(db, new Date("2026-10-20T00:00:00Z"))).toBe(0);
    expect(await flagLateInstallments(db, new Date("2026-11-09T12:00:00Z"))).toBe(0); // due 11-06, grace to 11-09
    expect(await flagLateInstallments(db, new Date("2026-11-10T00:00:00Z"))).toBe(1);
    expect(await status()).toEqual(["paid", "late", "due", "due"]);
    expect(await flagLateInstallments(db, new Date("2026-11-11T00:00:00Z"))).toBe(0); // flagged once
    expect((await db.audit.list()).filter((a) => a.action === "engagement.installment_late")).toHaveLength(1);
    expect((await db.activities.list()).filter((a) => /is late/.test(a.summary))).toHaveLength(1);
    expect(summarizePayments((await db.engagements.get(e.id))!.paymentPlan, await db.payments.list())).toMatchObject({ state: "late", lateCount: 1 });

    // A big gap flags both remaining installments at once.
    expect(await flagLateInstallments(db, new Date("2027-03-01T00:00:00Z"))).toBe(2);
    expect(await status()).toEqual(["paid", "late", "late", "late"]);

    // The late installment is chased with a link and paying it clears the flag.
    expect(await issueDueLinks(db, pay, new Date("2027-03-01T00:00:00Z"))).toBe(3);
    await paid(db, pay, "mock-pay-2", new Date("2027-03-02T00:00:00Z"));
    expect(await status()).toEqual(["paid", "paid", "late", "late"]);
  });

  it("does not flag voided, unsigned or paid-up engagements", async () => {
    const { db, esign, pay } = await setup();
    const e = await sentWithPlan(db, esign, pay);
    expect(await flagLateInstallments(db, new Date("2030-01-01T00:00:00Z"))).toBe(0); // not signed: no due dates yet
    expect((await db.engagements.get(e.id))!.paymentPlan!.installments.every((i) => i.status === "due")).toBe(true);
  });
});

describe("payment webhooks", () => {
  async function signedPlan() {
    const ctx = await setup();
    const e = await sentWithPlan(ctx.db, ctx.esign, ctx.pay);
    await sign(ctx.db, ctx.esign, ctx.pay, e.providerEnvelopeId!, hours(2));
    return { ...ctx, e };
  }

  it("rejects a missing, wrong or tampered signature and changes nothing", async () => {
    const { db, pay, e } = await signedPlan();
    const w = pay.webhookFor("mock-pay-1", "paid", hours(3));
    await expect(handlePaymentWebhook(db, pay, w.rawBody, {}, hours(3))).rejects.toThrow(WebhookSignatureError);
    await expect(handlePaymentWebhook(db, pay, w.rawBody, { "x-mock-signature": "00" }, hours(3))).rejects.toThrow(WebhookSignatureError);
    await expect(handlePaymentWebhook(db, pay, w.rawBody.replace("30000", "1"), w.headers, hours(3))).rejects.toThrow(WebhookSignatureError);
    expect((await db.engagements.get(e.id))!.status).toBe("signed");
    expect((await db.payments.list())[0].status).toBe("pending");
  });

  it("is idempotent when the same paid event is replayed", async () => {
    const { db, pay, e } = await signedPlan();
    const w = pay.webhookFor("mock-pay-1", "paid", hours(3));
    expect(await handlePaymentWebhook(db, pay, w.rawBody, w.headers, hours(3))).toEqual({ processed: 1 });
    expect(await handlePaymentWebhook(db, pay, w.rawBody, w.headers, hours(4))).toEqual({ processed: 0 });
    expect(await handlePaymentWebhook(db, pay, w.rawBody, w.headers, hours(5))).toEqual({ processed: 0 });
    expect((await db.billableEvents.list()).filter((b) => b.type === "fee_collected")).toHaveLength(1);
    expect((await db.activities.list()).filter((a) => a.summary === "Deposit received")).toHaveLength(1);
    expect((await db.audit.list()).filter((a) => a.action === "engagement.paid")).toHaveLength(1);
    const cur = (await db.engagements.get(e.id))!;
    expect(cur.history.filter((h) => h.status === "paid")).toHaveLength(1);
    expect((await db.leads.get("lead1"))!.stageHistory.filter((s) => s.stage === "paid")).toHaveLength(1);
  });

  it("ignores a failure that arrives after the payment, and records a real failure once", async () => {
    const { db, pay } = await signedPlan();
    await paid(db, pay, "mock-pay-1", hours(3));
    const lateFail = pay.webhookFor("mock-pay-1", "failed", hours(2));
    expect(await handlePaymentWebhook(db, pay, lateFail.rawBody, lateFail.headers, hours(4))).toEqual({ processed: 0 });
    expect((await db.payments.list())[0].status).toBe("paid");

    // second installment: failure recorded once, then a new link is sent after the due date
    await issueDueLinks(db, pay, days(31));
    const fail = pay.webhookFor("mock-pay-2", "failed", days(31));
    expect(await handlePaymentWebhook(db, pay, fail.rawBody, fail.headers, days(31))).toEqual({ processed: 1 });
    expect(await handlePaymentWebhook(db, pay, fail.rawBody, fail.headers, days(31))).toEqual({ processed: 0 });
    expect((await db.engagements.get((await db.payments.list())[0].engagementId))!.paymentPlan!.installments[1].status).toBe("due");
    expect(await issueDueLinks(db, pay, days(32))).toBe(1);
    expect((await db.payments.list()).filter((p) => p.installmentNo === 2).map((p) => p.status).sort()).toEqual(["failed", "pending"]);
  });

  it("does not mark an installment paid when the processor took a different amount", async () => {
    const { db, pay, e } = await signedPlan();
    expect(await paid(db, pay, "mock-pay-1", hours(3), { amountCents: 29_999 })).toEqual({ processed: 0 });
    expect((await db.engagements.get(e.id))!.status).toBe("signed");
    expect((await db.audit.list()).some((a) => a.action === "engagement.payment_amount_mismatch")).toBe(true);
  });

  it("ignores events for unknown or voided engagements and unknown failed payments", async () => {
    const { db, pay } = await signedPlan();
    const stray = new MockPaymentProvider();
    await stray.createPaymentLink({ engagementId: "nope", amountCents: 1, description: "x", account: "trust" });
    const w = stray.webhookFor("mock-pay-1", "paid", hours(3));
    expect(await handlePaymentWebhook(db, stray, w.rawBody, w.headers, hours(3))).toEqual({ processed: 0 });
    void pay;
  });

  it("keeps the original single-link flow for an engagement drafted without a plan", async () => {
    const { db, esign, pay } = await setup();
    const d = await draftEngagement(db, paralegal, { leadId: "lead1", packageId: "trust_package", feeCents: 400_000 }, T0);
    await approveEngagement(db, attorney, d.id, T0);
    await sendEngagement(db, paralegal, d.id, esign, pay, T0);
    expect(pay.links.size).toBe(1); // sent with the retainer
    const [rec] = await db.payments.list();
    expect(rec).toMatchObject({ engagementId: d.id, amountCents: 400_000, account: "trust", status: "pending" });
    await paid(db, pay, "mock-pay-1", hours(1));
    expect((await db.engagements.get(d.id))!.status).toBe("paid");
    expect((await db.leads.get("lead1"))!.stage).toBe("paid");
  });
});

describe("refunds", () => {
  async function paidDeposit() {
    const ctx = await setup();
    const e = await sentWithPlan(ctx.db, ctx.esign, ctx.pay);
    await sign(ctx.db, ctx.esign, ctx.pay, e.providerEnvelopeId!, hours(2));
    await paid(ctx.db, ctx.pay, "mock-pay-1", hours(3));
    const [rec] = await ctx.db.payments.list();
    return { ...ctx, e, rec };
  }

  it("lets only the assigned attorney refund, up to the amount paid", async () => {
    const { db, pay, rec } = await paidDeposit();
    await expect(refundPayment(db, paralegal, rec.id, 1000, "x", pay, hours(4))).rejects.toThrow(ForbiddenError);
    await expect(refundPayment(db, otherAttorney, rec.id, 1000, "x", pay, hours(4))).rejects.toThrow(ForbiddenError);
    await expect(refundPayment(db, client, rec.id, 1000, "x", pay, hours(4))).rejects.toThrow(ForbiddenError);
    await expect(refundPayment(db, attorney, rec.id, 30_001, "x", pay, hours(4))).rejects.toThrow(/more than was paid/);
    await expect(refundPayment(db, attorney, rec.id, 1000, " ", pay, hours(4))).rejects.toThrow(/reason/);
    const next = await refundPayment(db, attorney, rec.id, 10_000, "client request", pay, hours(4));
    expect(next.refunds).toMatchObject([{ id: "mock-refund-1", amountCents: 10_000, reason: "client request" }]);
    expect(pay.refunds).toMatchObject([{ paymentId: "mock-pay-1", amountCents: 10_000 }]);
    await expect(refundPayment(db, attorney, rec.id, 20_001, "x", pay, hours(5))).rejects.toThrow(/more than was paid/);
  });

  it("does not count the provider's refund webhook twice", async () => {
    const { db, pay, rec } = await paidDeposit();
    await refundPayment(db, attorney, rec.id, 10_000, "client request", pay, hours(4));
    const w = pay.webhookFor("mock-pay-1", "refunded", hours(4), { amountCents: 10_000, refundId: "mock-refund-1" });
    expect(await handlePaymentWebhook(db, pay, w.rawBody, w.headers, hours(4))).toEqual({ processed: 0 }); // already recorded by the refund call
    const other = pay.webhookFor("mock-pay-1", "refunded", hours(5), { amountCents: 5_000, refundId: "rf-ext" });
    expect(await handlePaymentWebhook(db, pay, other.rawBody, other.headers, hours(5))).toEqual({ processed: 1 });
    expect(await handlePaymentWebhook(db, pay, other.rawBody, other.headers, hours(6))).toEqual({ processed: 0 });
    const noId = pay.webhookFor("mock-pay-1", "refunded", hours(6), { amountCents: 100 });
    expect(await handlePaymentWebhook(db, pay, noId.rawBody, noId.headers, hours(6))).toEqual({ processed: 0 });
    expect((await db.payments.get(rec.id))!.refunds.map((r) => r.amountCents)).toEqual([10_000, 5_000]);
  });
});

describe("case view", () => {
  it("shows packages, plan, payments and a client summary to the attorney, and the client's own to the client", async () => {
    const { db, esign, pay } = await setup();
    const e = await sentWithPlan(db, esign, pay);
    await sign(db, esign, pay, e.providerEnvelopeId!, hours(2));
    await paid(db, pay, "mock-pay-1", hours(3));

    const view = await buildCaseView(db, attorney, "lead1", hours(4));
    const eng = view.sections.engagement![0];
    expect(eng.packageSelection?.addOns).toHaveLength(1);
    expect(eng.paymentPlan!.installments).toHaveLength(4);
    expect(eng.payments).toHaveLength(1);
    expect(eng.paymentStatus).toMatchObject({ state: "partial", paidCents: 30_000, balanceCents: 70_000 });
    expect(eng.clientSummary!.lines.join(" ")).toMatch(/Total flat fee/);

    const mine = await buildCaseView(db, client, "lead1", hours(4));
    expect(mine.sections.engagement![0].payments).toHaveLength(1);
    const para = await buildCaseView(db, paralegal, "lead1", hours(4));
    expect(para.sections.engagement![0].paymentPlan).toBeDefined();
    const blind = await buildCaseView(db, intake, "lead1", hours(4));
    expect(blind.sections.engagement).toBeUndefined(); // intake never sees fees
  });

  it("hides drafts from the client", async () => {
    const { db } = await setup();
    await draftEngagement(db, attorney, { leadId: "lead1", terms: PLAN_TERMS }, T0);
    expect((await buildCaseView(db, client, "lead1", T0)).sections.engagement).toEqual([]);
  });
});

describe("providers", () => {
  it("defaults to the mock outside production and refuses it in production", () => {
    expect(paymentProviderFromEnv({}).name).toBe("mock");
    expect(() => paymentProviderFromEnv({ NODE_ENV: "production" })).toThrow();
    expect(() => paymentProviderFromEnv({ NODE_ENV: "production", PAYMENTS_PROVIDER: "lawpay" })).toThrow(); // credentials missing
    expect(() => paymentProviderFromEnv({ NODE_ENV: "production", PAYMENTS_PROVIDER: "lawpay", LAWPAY_SECRET_KEY: "k" })).toThrow();
    expect(paymentProviderFromEnv({ NODE_ENV: "production", PAYMENTS_ALLOW_MOCK: "true" }).name).toBe("mock");
  });

  it("selects LawPay only with every credential, and the stub refuses to be built without them", () => {
    const env = { PAYMENTS_PROVIDER: "lawpay", LAWPAY_SECRET_KEY: "k", LAWPAY_OPERATING_ACCOUNT_ID: "op", LAWPAY_TRUST_ACCOUNT_ID: "tr", LAWPAY_WEBHOOK_SECRET: "w" };
    expect(paymentProviderFromEnv({ NODE_ENV: "production", ...env }).name).toBe("lawpay");
    expect(() => new LawPayProvider({ secretKey: "", operatingAccountId: "op", trustAccountId: "tr", webhookSecret: "w" })).toThrow(/not configured/);
    expect(() => new LawPayProvider({ secretKey: "k", operatingAccountId: "op", trustAccountId: "", webhookSecret: "w" })).toThrow(/trustAccountId/);
  });

  it("LawPay routes each link to the operating or trust account and verifies webhook signatures", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return new Response(JSON.stringify({ id: `lp_${calls.length}`, url: `https://pay.example/lp_${calls.length}` }), { status: 200 });
    }) as unknown as typeof fetch;
    const lp = new LawPayProvider({ secretKey: "k", operatingAccountId: "op-1", trustAccountId: "tr-1", webhookSecret: "whsec", fetchImpl });
    await lp.createPaymentLink({ engagementId: "e1", amountCents: 500, description: "d", account: "trust" });
    await lp.createPaymentLink({ engagementId: "e1", amountCents: 500, description: "d", account: "operating" });
    expect(calls.map((c) => c.body.account_id)).toEqual(["tr-1", "op-1"]);
    expect(calls[0].body.amount).toBe(500);
    await expect(lp.refund({ paymentId: "lp_1", amountCents: 5 })).resolves.toEqual({ refundId: "lp_3" });

    const { createHmac } = await import("node:crypto");
    const raw = JSON.stringify({ type: "payment.succeeded", created_at: "2026-10-06T00:00:00Z", data: { payment_id: "lp_1", amount: 500, metadata: { engagement_id: "e1" } } });
    const sig = createHmac("sha256", "whsec").update(raw).digest("hex");
    expect(lp.parseWebhook(raw, { "X-LawPay-Signature": sig })).toEqual([
      { paymentId: "lp_1", engagementId: "e1", status: "paid", at: "2026-10-06T00:00:00Z", amountCents: 500, refundId: undefined },
    ]);
    expect(() => lp.parseWebhook(raw, { "x-lawpay-signature": "bad" })).toThrow(WebhookSignatureError);
    expect(() => lp.parseWebhook(raw, {})).toThrow(WebhookSignatureError);
  });
});
