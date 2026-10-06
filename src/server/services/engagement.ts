/**
 * Engagement (e-signed retainer) flow: attorney drafts and approves, the platform
 * sends it for signature with a payment link, and provider webhooks move it
 * forward. Statuses only move forward; replayed or out-of-order webhooks are
 * ignored. Audit details hold ids and statuses only, never fees or letter text.
 */
import { randomUUID } from "node:crypto";
import { firm, retainerPayments } from "@/config/firm";
import type { PackageSelection, PaymentPlan } from "@/lib/retainerPlan";
import type { Db } from "@/server/db";
import { audit } from "@/server/audit/log";
import { assertCan, canOnLead, ForbiddenError } from "@/server/auth/policy";
import type { EsignProvider } from "@/server/esign/provider";
import type { PaymentProvider } from "@/server/esign/payments";
import { recordBillableEvent } from "@/server/fees/admin";
import { advanceStage, applyStatus, getEngagement, leadFor, RANK, seen, systemNote } from "@/server/services/engagementShared";
import {
  activatePlan,
  applyPaymentEvent,
  buildTerms,
  createPaymentFor,
  issueDueLinks,
  tierFor,
  type RetainerTermsInput,
} from "@/server/services/retainerPayments";
import type { Actor, Engagement, EngagementStatus, Lead } from "@/server/types";

export type FeeTreatment = "earned_on_receipt" | "trust_until_milestones";

export interface EngagementPackage {
  id: string;
  name: string;
  includes: string[];
  excludes: string[];
  /** PLACEHOLDER amounts: the attorney sets the real fee per engagement */
  defaultFeeCents: number;
  feeTreatment: FeeTreatment;
}

export const PACKAGES: Record<string, EngagementPackage> = {
  will_package: {
    id: "will_package",
    name: "Will Package",
    includes: ["Last will and testament", "Durable power of attorney", "Health care directive", "One signing meeting"],
    excludes: ["Trust drafting", "Real estate deeds", "Tax planning", "Court proceedings"],
    defaultFeeCents: 150000, // PLACEHOLDER
    feeTreatment: "earned_on_receipt",
  },
  trust_package: {
    id: "trust_package",
    name: "Revocable Living Trust Package",
    includes: ["Revocable living trust", "Pour-over will", "Durable power of attorney", "Health care directive", "Funding instructions", "One signing meeting"],
    excludes: ["Deed preparation unless listed in custom scope", "Tax planning beyond the trust", "Court proceedings"],
    defaultFeeCents: 400000, // PLACEHOLDER
    feeTreatment: "trust_until_milestones",
  },
  couples_trust: {
    id: "couples_trust",
    name: "Couples Trust Package",
    includes: ["Joint or coordinated revocable living trust", "Pour-over wills for each spouse", "Powers of attorney and health care directives for each spouse", "Funding instructions", "One signing meeting"],
    excludes: ["Deed preparation unless listed in custom scope", "Tax planning beyond the trust", "Court proceedings"],
    defaultFeeCents: 600000, // PLACEHOLDER
    feeTreatment: "trust_until_milestones",
  },
  special_needs_addon: {
    id: "special_needs_addon",
    name: "Special Needs Trust Add-on",
    includes: ["Third-party supplemental needs trust", "Letter of intent template"],
    excludes: ["Benefits eligibility applications", "Court proceedings"],
    defaultFeeCents: 200000, // PLACEHOLDER
    feeTreatment: "trust_until_milestones",
  },
  administration_flat: {
    id: "administration_flat",
    name: "Trust or Estate Administration (flat fee)",
    includes: ["Guidance through the administration steps for the stated matter", "Required notices and filings listed in the custom scope"],
    excludes: ["Contested matters and litigation", "Tax return preparation", "Court filing fees and costs"],
    defaultFeeCents: 500000, // PLACEHOLDER
    feeTreatment: "trust_until_milestones",
  },
};

export interface DraftInput {
  leadId: string;
  /** One of PACKAGES. Not needed when `terms` picks a good/better/best package. */
  packageId?: string;
  /** Flat fee in cents. Not needed when `terms` is given: the total comes from the attorney's package and add-on prices. */
  feeCents?: number;
  /**
   * Good/better/best package from the firm config, the attorney's price for it, add-ons and the payment
   * plan. The firm's payment-account setting decides the fee treatment in the letter.
   */
  terms?: RetainerTermsInput;
  customScope?: string;
  feeTreatment?: FeeTreatment;
  couple?: { spouseName: string };
  /** Defaults to ESIGN_PROVIDER or "mock" */
  providerName?: string;
}

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lines = (items: string[]) => items.map((i) => `  - ${i}`).join("\n");

/** Fills the engagement letter. DRAFT TEMPLATE: the attorney must replace the wording with the firm's approved letter. */
export function renderLetter(input: {
  clientName: string;
  pkg: EngagementPackage;
  feeCents: number;
  feeTreatment: FeeTreatment;
  customScope?: string;
  couple?: { spouseName: string };
  selection?: PackageSelection;
  plan?: PaymentPlan;
}): string {
  const { clientName, pkg, feeCents, feeTreatment, customScope, couple, selection, plan } = input;
  const addOnScope = selection?.addOns.length ? `\nAdd-ons:\n${lines(selection.addOns.map((a) => a.name))}` : "";
  const feeText = selection
    ? `The fee for the services above is a flat fee of ${money(feeCents)}: ${money(selection.tierPriceCents)} for the ${selection.tierName} package${selection.addOns.map((a) => `, ${money(a.priceCents)} for ${a.name}`).join("")}. It covers the included services listed in section 2. Work outside that scope requires a separate written agreement.`
    : `The fee for the services above is a flat fee of ${money(feeCents)}. It covers the included services listed in section 2. Work outside that scope requires a separate written agreement.`;
  let paymentText = "Payment is made directly to the Firm through the secure payment link sent with this agreement. Work begins when the signed agreement and payment are received.";
  if (plan?.mode === "full") {
    paymentText = "Payment is made in one payment directly to the Firm through the secure payment link sent after you sign this agreement. Work begins when the signed agreement and payment are received.";
  } else if (plan) {
    const [dep, ...rest] = plan.installments;
    const last = rest[rest.length - 1].amountCents;
    paymentText = `Payment is made directly to the Firm through secure payment links. A deposit of ${money(dep.amountCents)} is due when you sign this agreement, followed by ${rest.length} monthly payment${rest.length === 1 ? "" : "s"} of ${money(rest[0].amountCents)}${last !== rest[0].amountCents ? ` (the last is ${money(last)})` : ""}, the first one month after signing. The payments add up to the flat fee: there is no interest and no charge for paying in installments. Work begins when the signed agreement and the deposit are received.`;
  }
  const parties = couple ? `${clientName} and ${couple.spouseName} ("Clients")` : `${clientName} ("Client")`;
  const treatment =
    feeTreatment === "earned_on_receipt"
      ? "The flat fee is earned on receipt and will be deposited in the firm's operating account. If the engagement ends early, any unearned portion will be refunded as the rules of professional conduct require."
      : "The flat fee will be deposited in the firm's client trust account and withdrawn only as the agreed milestones are completed. Any unearned portion is refunded if the engagement ends early.";
  const parts = [
    "*** DRAFT TEMPLATE: the attorney must replace this wording with the firm's approved engagement letter before sending ***",
    `ENGAGEMENT AGREEMENT\n${firm.firmLegalName}\n${firm.officeAddress}`,
    `1. PARTIES\nThis agreement is between ${firm.firmLegalName} ("Firm") and ${parties}. The responsible attorney is ${firm.attorneyName}.`,
    `2. SCOPE OF REPRESENTATION\nPackage: ${pkg.name}\nIncluded:\n${lines(pkg.includes)}\nNot included:\n${lines(pkg.excludes)}${addOnScope}${customScope ? `\nAdditional scope agreed with the attorney:\n  ${customScope}` : ""}`,
    `3. FLAT FEE\n${feeText}`,
    `4. PAYMENT TERMS\n${paymentText}`,
    `5. FLAT FEE TREATMENT\n${treatment}`,
    "6. FILE RETENTION\nThe Firm will keep the client file for the period required by the rules of professional conduct and will then destroy it securely. Original signed estate planning documents are returned to the client or held in safekeeping only if agreed in writing.",
    "7. COMMUNICATION CONSENT\nClient consents to the Firm communicating by email, text message and phone using the contact details on file, and understands that unencrypted channels carry some risk. Client may change these preferences at any time.",
  ];
  if (couple) {
    parts.push(
      `8. JOINT REPRESENTATION AND CONFLICT WAIVER\nThe Firm will represent ${clientName} and ${couple.spouseName} jointly. Information one spouse shares with the Firm about this matter may be shared with the other. Their interests may differ, for example over who inherits or how property is divided, and if a conflict arises that cannot be resolved the Firm may have to withdraw from representing one or both. Each spouse may consult separate counsel. By signing, each spouse consents to joint representation after this explanation.`,
    );
  }
  parts.push(`${couple ? 9 : 8}. SIGNATURES\nClient signature: /sign/    Date: /date/`);
  return parts.join("\n\n");
}

async function assertOnLead(db: Db, actor: Actor, e: Engagement, action: "draft_engagement" | "approve_engagement", now: Date): Promise<Lead> {
  const lead = await leadFor(db, e);
  assertCan(canOnLead(actor, action, lead, await db.assignments.list(), now));
  return lead;
}

export async function draftEngagement(db: Db, actor: Actor, input: DraftInput, now = new Date()): Promise<Engagement> {
  const lead = await db.leads.get(input.leadId);
  if (!lead) throw new Error(`lead not found: ${input.leadId}`);
  assertCan(canOnLead(actor, "draft_engagement", lead, await db.assignments.list(), now));
  let pkg: EngagementPackage;
  let feeCents: number;
  let terms: ReturnType<typeof buildTerms> | undefined;
  if (input.terms) {
    // Good/better/best: the attorney's prices and plan from the firm config. The total is computed, never typed in twice.
    terms = buildTerms(input.terms);
    if (input.feeCents !== undefined && input.feeCents !== terms.selection.totalCents) throw new Error("feeCents does not match the package and add-on prices");
    const tier = tierFor(input.terms.tierId);
    pkg = {
      id: tier.id,
      name: tier.name,
      includes: tier.includes,
      excludes: tier.excludes,
      defaultFeeCents: 0,
      feeTreatment: retainerPayments.account === "trust" ? "trust_until_milestones" : "earned_on_receipt",
    };
    feeCents = terms.selection.totalCents;
  } else {
    const found = input.packageId ? PACKAGES[input.packageId] : undefined;
    if (!found) throw new Error(`unknown package: ${input.packageId}`);
    pkg = found;
    feeCents = input.feeCents as number;
    if (!Number.isInteger(feeCents) || feeCents <= 0) throw new Error("feeCents must be a positive integer");
  }
  if (input.couple && !input.couple.spouseName.trim()) throw new Error("spouseName required");
  const person = await db.persons.get(lead.personId);
  if (!person) throw new Error(`person not found: ${lead.personId}`);
  const lawyerId = lead.assignedLawyerId!;
  const lawyer = await db.lawyers.get(lawyerId);
  const firmId = lead.firmId ?? lawyer?.firmId;
  if (!firmId) throw new Error("lead has no firm");

  const letter = renderLetter({
    clientName: `${person.firstName} ${person.lastName}`,
    pkg,
    feeCents,
    // With good/better/best terms the firm's payment-account setting decides the treatment, so the letter matches where the money goes.
    feeTreatment: terms ? pkg.feeTreatment : (input.feeTreatment ?? pkg.feeTreatment),
    customScope: input.customScope,
    couple: input.couple,
    selection: terms?.selection,
    plan: terms?.plan,
  });
  const at = now.toISOString();
  const e = await db.engagements.insert({
    id: randomUUID(),
    leadId: lead.id,
    firmId,
    lawyerId,
    packageId: pkg.id,
    feeCents,
    customScope: input.customScope,
    packageSelection: terms?.selection,
    paymentPlan: terms?.plan,
    status: "draft",
    provider: input.providerName ?? process.env.ESIGN_PROVIDER ?? "mock",
    letter,
    history: [{ status: "draft", at }],
    remindersSent: [],
    documentIds: [],
  });
  await audit(db, actor, { action: "engagement.draft", resourceType: "engagement", resourceId: e.id, leadId: lead.id, detail: { packageId: pkg.id, status: "draft", ...(terms ? { planMode: terms.plan.mode, account: terms.plan.account } : {}) }, at: now });
  return e;
}

export async function approveEngagement(db: Db, actor: Actor, engagementId: string, now = new Date()): Promise<Engagement> {
  const e = await getEngagement(db, engagementId);
  await assertOnLead(db, actor, e, "approve_engagement", now);
  if (e.status !== "draft") throw new Error(`cannot approve an engagement that is ${e.status}`);
  const at = now.toISOString();
  const next = await db.engagements.update(e.id, {
    status: "approved",
    approvedBy: actor.userId,
    approvedAt: at,
    history: [...e.history, { status: "approved", at }],
  });
  await audit(db, actor, { action: "engagement.approve", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { status: "approved" }, at: now });
  return next;
}

export async function sendEngagement(
  db: Db,
  actor: Actor,
  engagementId: string,
  provider: EsignProvider,
  payments: PaymentProvider,
  now = new Date(),
): Promise<Engagement> {
  const e = await getEngagement(db, engagementId);
  const lead = await assertOnLead(db, actor, e, "draft_engagement", now);
  if (e.status !== "approved" || !e.approvedBy) throw new Error("engagement must be approved by the attorney before sending");
  const person = await db.persons.get(lead.personId);
  if (!person || !e.letter) throw new Error("engagement is missing client or letter");

  const envelope = await provider.createEnvelope({
    engagementId: e.id,
    signer: { name: `${person.firstName} ${person.lastName}`, email: person.email, phone: person.phone },
    documentTitle: `Engagement Agreement - ${firm.firmLegalName}`,
    documentText: e.letter,
    requireSmsCode: true,
    language: person.language,
  });
  // With a payment plan the link goes out after the retainer is signed (see onSigned). An engagement
  // drafted without one keeps the original flow: a single link sent with the retainer.
  let paymentId: string | undefined;
  if (!e.paymentPlan) {
    const account = /client trust account/.test(e.letter) ? "trust" : "operating";
    const rec = await createPaymentFor(db, payments, e, { amountCents: e.feeCents, description: `Flat fee, ${PACKAGES[e.packageId]?.name ?? e.packageId}`, account }, now);
    paymentId = rec.id;
  }

  const at = now.toISOString();
  const next = await db.engagements.update(e.id, {
    status: "sent",
    provider: provider.name,
    providerEnvelopeId: envelope.envelopeId,
    history: [...e.history, { status: "sent", at }],
  });
  await advanceStage(db, lead, "proposal_sent", actor.userId, at);
  await systemNote(db, lead.id, "Engagement sent for signature", at, actor.userId);
  await audit(db, actor, {
    action: "engagement.send",
    resourceType: "engagement",
    resourceId: e.id,
    leadId: lead.id,
    detail: { status: "sent", provider: provider.name, envelopeId: envelope.envelopeId, ...(paymentId ? { paymentId } : {}) },
    at: now,
  });
  return next;
}

export type StoreBlob = (key: string, bytes: Uint8Array) => void | Promise<void>;

export async function handleEsignWebhook(
  db: Db,
  provider: EsignProvider,
  rawBody: string,
  headers: Record<string, string>,
  now = new Date(),
  storeBlob: StoreBlob = () => undefined,
  /** When given, the payment link is sent as soon as the retainer is signed; otherwise the cron sweep sends it (issueDueLinks). */
  payments?: PaymentProvider,
): Promise<{ processed: number }> {
  const events = provider.parseWebhook(rawBody, headers); // throws on a bad signature
  let processed = 0;
  for (const ev of events) {
    const e = (await db.engagements.list((x) => x.providerEnvelopeId === ev.envelopeId))[0];
    if (!e || e.status === "voided" || seen(e, ev.status as EngagementStatus)) continue; // unknown, voided or duplicate
    if (ev.status === "declined") {
      await audit(db, "system", { action: "engagement.declined", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { status: "declined" }, at: now });
      await systemNote(db, e.leadId, "Client declined the engagement", ev.at);
      await db.engagements.update(e.id, { history: [...e.history, { status: "voided", at: ev.at }], status: "voided" });
      processed++;
      continue;
    }
    if (ev.status === "voided") {
      await db.engagements.update(e.id, { status: "voided", history: [...e.history, { status: "voided", at: ev.at }] });
      await audit(db, "system", { action: "engagement.void", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { status: "voided", via: "webhook" }, at: now });
      processed++;
      continue;
    }
    if (ev.status === "sent") continue;
    // A webhook never moves an engagement back: "viewed" after "signed" only adds nothing.
    if (ev.status === "viewed" && RANK[e.status] >= RANK.viewed) continue;
    let next = await applyStatus(db, e, ev.status, ev.at);
    if (ev.status === "signed") {
      next = await onSigned(db, provider, next, ev.at, storeBlob);
      next = await activatePlan(db, next, ev.at); // fixes the due dates from the signing day
      if (payments && next.paymentPlan) await issueDueLinks(db, payments, now, e.id);
    }
    await audit(db, "system", { action: `engagement.${ev.status}`, resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { status: next.status }, at: now });
    processed++;
  }
  return { processed };
}

async function onSigned(db: Db, provider: EsignProvider, e: Engagement, at: string, storeBlob: StoreBlob): Promise<Engagement> {
  const lead = await leadFor(db, e);
  const { pdf, auditCertificate } = await provider.downloadSigned(e.providerEnvelopeId!);
  const files = [
    { kind: "engagement_signed" as const, name: "Signed engagement agreement.pdf", key: `engagements/${e.id}/signed.pdf`, bytes: pdf },
    { kind: "audit_certificate" as const, name: "Signature audit certificate.pdf", key: `engagements/${e.id}/audit-certificate.pdf`, bytes: auditCertificate },
  ];
  const ids: string[] = [];
  for (const f of files) {
    await storeBlob(f.key, f.bytes);
    const doc = await db.documents.insert({
      id: randomUUID(),
      leadId: e.leadId,
      name: f.name,
      kind: f.kind,
      contentType: "application/pdf",
      sizeBytes: f.bytes.byteLength,
      storageKey: f.key,
      uploadedBy: "system",
      uploadedAt: at,
      scanStatus: "clean", // generated by the e-sign provider, not uploaded by a user
      visibility: "client",
    });
    ids.push(doc.id);
  }
  await advanceStage(db, lead, "retainer_signed", "system", at);
  // Recorded for analytics; the fee engine's compliance lock decides whether anything is billable.
  await recordBillableEvent(db, { type: "retainer_signed", occurredAt: at, state: lead.state, lawyerId: e.lawyerId });
  await systemNote(db, e.leadId, "Engagement signed by client", at);
  return await db.engagements.update(e.id, { documentIds: [...e.documentIds, ...ids] });
}

/** Verifies the provider signature, then records each event against its payment. Replays and out-of-order events change nothing. */
export async function handlePaymentWebhook(
  db: Db,
  payments: PaymentProvider,
  rawBody: string,
  headers: Record<string, string>,
  now = new Date(),
): Promise<{ processed: number }> {
  const events = payments.parseWebhook(rawBody, headers); // throws on a bad signature
  let processed = 0;
  for (const ev of events) {
    if (await applyPaymentEvent(db, ev, now)) processed++;
  }
  return { processed };
}

export async function countersignEngagement(db: Db, actor: Actor, engagementId: string, now = new Date()): Promise<Engagement> {
  const e = await getEngagement(db, engagementId);
  await assertOnLead(db, actor, e, "approve_engagement", now); // attorney only
  if (actor.lawyerId !== e.lawyerId) throw new ForbiddenError("Only the assigned attorney can countersign");
  if (e.status !== "signed" && e.status !== "paid") throw new Error(`cannot countersign an engagement that is ${e.status}`);
  const at = now.toISOString();
  const next = await db.engagements.update(e.id, { status: "countersigned", history: [...e.history, { status: "countersigned", at }] });
  await audit(db, actor, { action: "engagement.countersign", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { status: "countersigned" }, at: now });
  return next;
}

const HOUR = 3_600_000;
export const REMINDER_SCHEDULE = [
  { key: "24h", afterMs: 24 * HOUR },
  { key: "72h", afterMs: 72 * HOUR },
  { key: "7d", afterMs: 168 * HOUR },
] as const;

/** Sends at most one reminder per engagement per run; thresholds already passed are marked so each fires once. */
export async function sendDueReminders(db: Db, provider: EsignProvider, now = new Date()): Promise<number> {
  let count = 0;
  for (const e of await db.engagements.list((x) => (x.status === "sent" || x.status === "viewed") && !!x.providerEnvelopeId)) {
    const sentAt = [...e.history].reverse().find((h) => h.status === "sent")?.at;
    if (!sentAt) continue;
    const elapsed = now.getTime() - new Date(sentAt).getTime();
    const due = REMINDER_SCHEDULE.filter((r) => elapsed >= r.afterMs && !e.remindersSent.includes(r.key));
    if (due.length === 0) continue;
    await provider.sendReminder(e.providerEnvelopeId!);
    await db.engagements.update(e.id, { remindersSent: [...e.remindersSent, ...due.map((d) => d.key)] });
    await audit(db, "system", { action: "engagement.reminder", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { reminder: due[due.length - 1].key }, at: now });
    count++;
  }
  return count;
}

export async function voidEngagement(db: Db, actor: Actor, engagementId: string, provider: EsignProvider, reason: string, now = new Date()): Promise<Engagement> {
  const e = await getEngagement(db, engagementId);
  await assertOnLead(db, actor, e, "draft_engagement", now);
  if (e.status === "voided") return e;
  if (RANK[e.status] >= RANK.signed) throw new Error("a signed engagement cannot be voided");
  if (e.providerEnvelopeId) await provider.voidEnvelope(e.providerEnvelopeId, reason);
  const at = now.toISOString();
  const next = await db.engagements.update(e.id, { status: "voided", history: [...e.history, { status: "voided", at }] });
  await audit(db, actor, { action: "engagement.void", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { status: "voided" }, at: now });
  return next;
}
