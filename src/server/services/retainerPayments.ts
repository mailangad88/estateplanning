/**
 * Retainer payments: package selection, payment plans, payment links, payment webhooks,
 * late flagging and refunds.
 *
 * - Prices are set by the attorney per engagement. The firm config (src/config/firm.ts) lists the
 *   packages, add-ons, plan limits and which account (trust by default) payments are directed to.
 * - Payment links go out after the retainer is signed (the legacy path with no plan sends one with the
 *   retainer). Money goes from the client straight to the firm's own processor account.
 * - Webhooks are idempotent: a payment already paid, a failure already recorded and a refund id already
 *   seen are all skipped, so provider retries and replays change nothing.
 * - Audit detail holds ids, statuses and installment numbers, never amounts.
 */
import { randomUUID } from "node:crypto";
import { addOns as ADD_ONS, packages as TIERS, retainerPayments, type Package } from "@/config/firm";
import {
  activateSchedule,
  buildPlan,
  isLate,
  priceSelection,
  type Installment,
  type PackageSelection,
  type PaymentPlan,
  type PlanInput,
  type PlanLimits,
} from "@/lib/retainerPlan";
import type { Db } from "@/server/db";
import { audit } from "@/server/audit/log";
import { assertCan, canOnLead } from "@/server/auth/policy";
import type { PaymentProvider, PaymentWebhookEvent } from "@/server/esign/payments";
import { recordBillableEvent } from "@/server/fees/admin";
import { advanceStage, applyStatus, getEngagement, leadFor, RANK, systemNote } from "@/server/services/engagementShared";
import type { Actor, Engagement, PaymentRecord } from "@/server/types";

export type RetainerConfig = typeof retainerPayments;

/** What a drafter passes to price an engagement. Prices are the attorney's, in cents. */
export interface RetainerTermsInput {
  tierId: string;
  tierPriceCents: number;
  addOns?: { id: string; priceCents: number }[];
  plan?: PlanInput;
}

export function tierFor(tierId: string): Package {
  const tier = TIERS.find((t) => t.id === tierId);
  if (!tier) throw new Error(`unknown package: ${tierId}`);
  return tier;
}

export function buildTerms(input: RetainerTermsInput, cfg: RetainerConfig = retainerPayments): { selection: PackageSelection; plan: PaymentPlan } {
  const tier = tierFor(input.tierId);
  const selection = priceSelection({
    tierId: tier.id,
    tierName: tier.name,
    tierPriceCents: input.tierPriceCents,
    addOns: (input.addOns ?? []).map((a) => {
      const def = ADD_ONS.find((x) => x.id === a.id);
      if (!def) throw new Error(`unknown add-on: ${a.id}`);
      return { id: def.id, name: def.name, priceCents: a.priceCents };
    }),
  });
  const limits: PlanLimits = cfg.plan;
  return { selection, plan: buildPlan(selection.totalCents, input.plan ?? { mode: "full" }, limits, cfg.account) };
}

async function leadWithPermission(db: Db, actor: Actor, e: Engagement, action: "approve_engagement" | "view_engagement", now: Date) {
  const lead = await leadFor(db, e);
  assertCan(canOnLead(actor, action, lead, await db.assignments.list(), now));
  return lead;
}

/**
 * Creates a payment link at the provider and the matching record. The account comes from the plan
 * (set from the firm config when the engagement was drafted), so one engagement never mixes accounts.
 */
export async function createPaymentFor(
  db: Db,
  payments: PaymentProvider,
  e: Engagement,
  input: { amountCents: number; description: string; account: "operating" | "trust"; installmentNo?: number; dueOn?: string },
  now: Date,
): Promise<PaymentRecord> {
  const link = await payments.createPaymentLink({ engagementId: e.id, ...input });
  return await db.payments.insert({
    id: randomUUID(),
    engagementId: e.id,
    leadId: e.leadId,
    firmId: e.firmId,
    installmentNo: input.installmentNo,
    amountCents: input.amountCents,
    account: input.account,
    status: "pending",
    provider: payments.name,
    providerPaymentId: link.paymentId,
    linkUrl: link.url,
    createdAt: now.toISOString(),
    refunds: [],
  });
}

/**
 * Sends the payment link for every installment that is due and has no open link, on signed
 * engagements with an activated plan. Called when the retainer is signed and from the cron sweep, so
 * later installments get their link on their due date and a failed attempt gets a fresh link.
 */
export async function issueDueLinks(db: Db, payments: PaymentProvider, now = new Date(), engagementId?: string): Promise<number> {
  const today = now.toISOString().slice(0, 10);
  let issued = 0;
  const list = engagementId
    ? [await getEngagement(db, engagementId)]
    : await db.engagements.list((x) => !!x.paymentPlan?.activatedAt && x.status !== "voided");
  for (const e0 of list) {
    if (e0.status === "voided" || RANK[e0.status] < RANK.signed || !e0.paymentPlan?.activatedAt) continue;
    let plan = e0.paymentPlan;
    const mine = await db.payments.list(undefined, { engagementId: e0.id });
    for (const i of plan.installments) {
      if (i.status === "paid" || !i.dueOn || i.dueOn > today) continue;
      if (mine.some((p) => p.installmentNo === i.n && p.status === "pending")) continue;
      const rec = await createPaymentFor(
        db, payments, e0,
        { amountCents: i.amountCents, description: `Flat fee ${i.kind === "full" ? "payment" : i.kind === "deposit" ? "deposit" : `installment ${i.n - 1}`}`, account: plan.account, installmentNo: i.n, dueOn: i.dueOn },
        now,
      );
      plan = { ...plan, installments: plan.installments.map((x) => (x.n === i.n ? { ...x, paymentId: rec.id } : x)) };
      await systemNote(db, e0.leadId, `Payment link sent to the client (${i.kind === "installment" ? `installment ${i.n - 1} of ${plan.installments.length - 1}` : i.kind})`, now.toISOString());
      await audit(db, "system", { action: "engagement.payment_link_sent", resourceType: "engagement", resourceId: e0.id, leadId: e0.leadId, detail: { paymentId: rec.id, installmentNo: i.n, account: plan.account }, at: now });
      issued++;
    }
    if (plan !== e0.paymentPlan) await db.engagements.update(e0.id, { paymentPlan: plan });
  }
  return issued;
}

/** Fixes due dates when the retainer is signed. Returns the engagement as stored. */
export async function activatePlan(db: Db, e: Engagement, signedAt: string): Promise<Engagement> {
  if (!e.paymentPlan || e.paymentPlan.activatedAt) return e;
  return await db.engagements.update(e.id, { paymentPlan: activateSchedule(e.paymentPlan, signedAt) });
}

/**
 * Cron sweep step: flags unpaid installments that are more than `graceDays` past their due date as
 * late. Each installment is flagged once (it leaves "due"), so a repeated run flags nothing new.
 * Returns how many were newly flagged.
 */
export async function flagLateInstallments(db: Db, now = new Date(), graceDays = retainerPayments.plan.lateGraceDays): Promise<number> {
  let flagged = 0;
  for (const e of await db.engagements.list((x) => !!x.paymentPlan?.activatedAt && x.status !== "voided")) {
    const plan = e.paymentPlan!;
    const late = plan.installments.filter((i) => i.status === "due" && isLate(i, now, graceDays));
    if (!late.length) continue;
    const lateNos = new Set(late.map((i) => i.n));
    await db.engagements.update(e.id, {
      paymentPlan: { ...plan, installments: plan.installments.map((i): Installment => (lateNos.has(i.n) ? { ...i, status: "late" } : i)) },
    });
    for (const i of late) {
      await systemNote(db, e.leadId, `Payment is late (${i.kind === "installment" ? `installment ${i.n - 1}` : i.kind})`, now.toISOString());
      await audit(db, "system", { action: "engagement.installment_late", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { installmentNo: i.n, dueOn: i.dueOn }, at: now });
      flagged++;
    }
  }
  return flagged;
}

const sum = (xs: { amountCents: number }[]) => xs.reduce((s, x) => s + x.amountCents, 0);

/**
 * Applies one verified payment event. Returns true when it changed anything. A replayed event, an
 * event for a voided or unknown engagement, and an out-of-order one (a failure after payment) return false.
 */
export async function applyPaymentEvent(db: Db, ev: PaymentWebhookEvent, now: Date): Promise<boolean> {
  const e = await db.engagements.get(ev.engagementId);
  if (!e || e.status === "voided") return false;
  const lead = await leadFor(db, e);
  let rec = (await db.payments.list((p) => p.providerPaymentId === ev.paymentId, { engagementId: e.id }))[0];

  if (!rec) {
    // A payment the platform did not create a record for (for example a link made outside this flow):
    // record it from the event so the money is still tied to the engagement.
    if (ev.status !== "paid") return false;
    rec = await db.payments.insert({
      id: randomUUID(), engagementId: e.id, leadId: e.leadId, firmId: e.firmId,
      amountCents: ev.amountCents ?? e.feeCents, account: e.paymentPlan?.account ?? retainerPayments.account,
      status: "pending", provider: "unknown", providerPaymentId: ev.paymentId, createdAt: ev.at, refunds: [],
    });
  }

  if (ev.status === "failed") {
    if (rec.status !== "pending") return false;
    await db.payments.update(rec.id, { status: "failed" });
    await audit(db, "system", { action: "engagement.payment_failed", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { paymentId: ev.paymentId }, at: now });
    await systemNote(db, e.leadId, "Payment attempt failed", ev.at);
    return true;
  }

  if (ev.status === "refunded") {
    if (rec.status !== "paid" || !ev.refundId || rec.refunds.some((r) => r.id === ev.refundId)) return false;
    const amount = ev.amountCents ?? 0;
    if (!Number.isInteger(amount) || amount <= 0 || sum(rec.refunds) + amount > rec.amountCents) {
      await audit(db, "system", { action: "engagement.refund_mismatch", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { paymentId: ev.paymentId, refundId: ev.refundId }, at: now });
      return false;
    }
    await db.payments.update(rec.id, { refunds: [...rec.refunds, { id: ev.refundId, amountCents: amount, at: ev.at }] });
    await audit(db, "system", { action: "engagement.payment_refunded", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { paymentId: ev.paymentId, refundId: ev.refundId }, at: now });
    await systemNote(db, e.leadId, "Payment refunded", ev.at);
    return true;
  }

  // paid
  if (rec.status === "paid") return false;
  if (ev.amountCents !== undefined && ev.amountCents !== rec.amountCents) {
    // The processor took a different amount than the schedule asked for: do not mark the installment paid.
    await audit(db, "system", { action: "engagement.payment_amount_mismatch", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { paymentId: ev.paymentId }, at: now });
    await systemNote(db, e.leadId, "A payment arrived for a different amount than expected and needs review", ev.at);
    return false;
  }
  await db.payments.update(rec.id, { status: "paid", paidAt: ev.at });
  let current = e;
  if (e.paymentPlan) {
    const n = rec.installmentNo;
    const plan: PaymentPlan = {
      ...e.paymentPlan,
      installments: e.paymentPlan.installments.map((i): Installment => (i.n === n ? { ...i, status: "paid", paymentId: rec!.id, paidAt: ev.at } : i)),
    };
    current = await db.engagements.update(e.id, { paymentPlan: plan });
  }
  const firstPayment = RANK[current.status] < RANK.paid;
  if (firstPayment) {
    await applyStatus(db, current, "paid", ev.at); // the first payment (deposit or full) makes the retainer effective
    await advanceStage(db, lead, "paid", "system", ev.at);
  }
  // Analytics only: the fee engine decides whether anything is billable under the firm structure.
  await recordBillableEvent(db, { type: "fee_collected", occurredAt: ev.at, state: lead.state, lawyerId: e.lawyerId, amountCents: rec.amountCents });
  const label = rec.installmentNo && current.paymentPlan?.mode === "plan" ? (rec.installmentNo === 1 ? "Deposit received" : `Installment ${rec.installmentNo - 1} received`) : "Engagement fee received";
  await systemNote(db, e.leadId, label, ev.at);
  await audit(db, "system", {
    action: firstPayment ? "engagement.paid" : "engagement.payment_received",
    resourceType: "engagement", resourceId: e.id, leadId: e.leadId,
    detail: { status: firstPayment ? "paid" : current.status, paymentId: ev.paymentId, installmentNo: rec.installmentNo, account: rec.account },
    at: now,
  });
  return true;
}

/** The assigned attorney refunds all or part of a paid payment. The provider returns it from the account it went to. */
export async function refundPayment(
  db: Db,
  actor: Actor,
  paymentId: string,
  amountCents: number,
  reason: string,
  provider: PaymentProvider,
  now = new Date(),
): Promise<PaymentRecord> {
  const rec = await db.payments.get(paymentId);
  if (!rec) throw new Error(`payment not found: ${paymentId}`);
  const e = await getEngagement(db, rec.engagementId);
  await leadWithPermission(db, actor, e, "approve_engagement", now); // attorney only: trust money
  if (rec.status !== "paid") throw new Error("only a paid payment can be refunded");
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("refund amount must be a positive whole number of cents");
  if (sum(rec.refunds) + amountCents > rec.amountCents) throw new Error("refund is more than was paid");
  if (!reason.trim()) throw new Error("a refund reason is required");
  const { refundId } = await provider.refund({ paymentId: rec.providerPaymentId, amountCents, reason });
  if (rec.refunds.some((r) => r.id === refundId)) return rec;
  const next = await db.payments.update(rec.id, { refunds: [...rec.refunds, { id: refundId, amountCents, at: now.toISOString(), reason }] });
  await audit(db, actor, { action: "engagement.payment_refunded", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { paymentId: rec.providerPaymentId, refundId }, at: now });
  await systemNote(db, e.leadId, "Payment refunded", now.toISOString(), actor.userId);
  return next;
}
