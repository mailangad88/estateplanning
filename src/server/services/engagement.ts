/**
 * Engagement (e-signed retainer) flow: attorney drafts and approves, the platform
 * sends it for signature with a payment link, and provider webhooks move it
 * forward. Statuses only move forward; replayed or out-of-order webhooks are
 * ignored. Audit details hold ids and statuses only, never fees or letter text.
 */
import { randomUUID } from "node:crypto";
import { firm } from "@/config/firm";
import type { Db } from "@/server/db";
import { audit } from "@/server/audit/log";
import { assertCan, canOnLead, ForbiddenError } from "@/server/auth/policy";
import type { EsignProvider } from "@/server/esign/provider";
import type { PaymentProvider } from "@/server/esign/payments";
import { recordBillableEvent } from "@/server/fees/admin";
import { STAGES, type Actor, type Engagement, type EngagementStatus, type Lead, type Stage } from "@/server/types";

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
  packageId: string;
  feeCents: number;
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
}): string {
  const { clientName, pkg, feeCents, feeTreatment, customScope, couple } = input;
  const parties = couple ? `${clientName} and ${couple.spouseName} ("Clients")` : `${clientName} ("Client")`;
  const treatment =
    feeTreatment === "earned_on_receipt"
      ? "The flat fee is earned on receipt and will be deposited in the firm's operating account. If the engagement ends early, any unearned portion will be refunded as the rules of professional conduct require."
      : "The flat fee will be deposited in the firm's client trust account and withdrawn only as the agreed milestones are completed. Any unearned portion is refunded if the engagement ends early.";
  const parts = [
    "*** DRAFT TEMPLATE: the attorney must replace this wording with the firm's approved engagement letter before sending ***",
    `ENGAGEMENT AGREEMENT\n${firm.firmLegalName}\n${firm.officeAddress}`,
    `1. PARTIES\nThis agreement is between ${firm.firmLegalName} ("Firm") and ${parties}. The responsible attorney is ${firm.attorneyName}.`,
    `2. SCOPE OF REPRESENTATION\nPackage: ${pkg.name}\nIncluded:\n${lines(pkg.includes)}\nNot included:\n${lines(pkg.excludes)}${customScope ? `\nAdditional scope agreed with the attorney:\n  ${customScope}` : ""}`,
    `3. FLAT FEE\nThe fee for the services above is a flat fee of ${money(feeCents)}. It covers the included services listed in section 2. Work outside that scope requires a separate written agreement.`,
    "4. PAYMENT TERMS\nPayment is made directly to the Firm through the secure payment link sent with this agreement. Work begins when the signed agreement and payment are received.",
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

async function getEngagement(db: Db, id: string): Promise<Engagement> {
  const e = await db.engagements.get(id);
  if (!e) throw new Error(`engagement not found: ${id}`);
  return e;
}

async function leadFor(db: Db, e: Engagement): Promise<Lead> {
  const lead = await db.leads.get(e.leadId);
  if (!lead) throw new Error(`lead not found: ${e.leadId}`);
  return lead;
}

async function assertOnLead(db: Db, actor: Actor, e: Engagement, action: "draft_engagement" | "approve_engagement", now: Date): Promise<Lead> {
  const lead = await leadFor(db, e);
  assertCan(canOnLead(actor, action, lead, await db.assignments.list(), now));
  return lead;
}

/** Moves the lead stage forward only. */
async function advanceStage(db: Db, lead: Lead, stage: Stage, by: string, at: string) {
  const current = await db.leads.get(lead.id) ?? lead;
  if (STAGES.indexOf(stage) <= STAGES.indexOf(current.stage)) return;
  await db.leads.update(lead.id, { stage, stageHistory: [...current.stageHistory, { stage, at, by }] });
}

async function systemNote(db: Db, leadId: string, summary: string, at: string, byUserId?: string) {
  await db.activities.insert({ id: randomUUID(), leadId, kind: "system", at, summary, byUserId });
}

export async function draftEngagement(db: Db, actor: Actor, input: DraftInput, now = new Date()): Promise<Engagement> {
  const lead = await db.leads.get(input.leadId);
  if (!lead) throw new Error(`lead not found: ${input.leadId}`);
  assertCan(canOnLead(actor, "draft_engagement", lead, await db.assignments.list(), now));
  const pkg = PACKAGES[input.packageId];
  if (!pkg) throw new Error(`unknown package: ${input.packageId}`);
  if (!Number.isInteger(input.feeCents) || input.feeCents <= 0) throw new Error("feeCents must be a positive integer");
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
    feeCents: input.feeCents,
    feeTreatment: input.feeTreatment ?? pkg.feeTreatment,
    customScope: input.customScope,
    couple: input.couple,
  });
  const at = now.toISOString();
  const e = await db.engagements.insert({
    id: randomUUID(),
    leadId: lead.id,
    firmId,
    lawyerId,
    packageId: pkg.id,
    feeCents: input.feeCents,
    customScope: input.customScope,
    status: "draft",
    provider: input.providerName ?? process.env.ESIGN_PROVIDER ?? "mock",
    letter,
    history: [{ status: "draft", at }],
    remindersSent: [],
    documentIds: [],
  });
  await audit(db, actor, { action: "engagement.draft", resourceType: "engagement", resourceId: e.id, leadId: lead.id, detail: { packageId: pkg.id, status: "draft" }, at: now });
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
  const treatment = /client trust account/.test(e.letter) ? "trust" : "operating";
  const link = await payments.createPaymentLink({
    engagementId: e.id,
    amountCents: e.feeCents,
    description: `Flat fee, ${PACKAGES[e.packageId]?.name ?? e.packageId}`,
    account: treatment,
  });

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
    detail: { status: "sent", provider: provider.name, envelopeId: envelope.envelopeId, paymentId: link.paymentId },
    at: now,
  });
  return next;
}

/** Forward order of engagement statuses. "voided" is terminal and handled separately. */
const RANK: Record<EngagementStatus, number> = { draft: 0, approved: 1, sent: 2, viewed: 3, signed: 4, paid: 5, countersigned: 6, voided: -1 };

function seen(e: Engagement, status: EngagementStatus) {
  return e.history.some((h) => h.status === status);
}

/** Moves to `status` only if it is ahead of the current one; always records the history entry once. */
async function applyStatus(db: Db, e: Engagement, status: EngagementStatus, at: string): Promise<Engagement> {
  const history = seen(e, status) ? e.history : [...e.history, { status, at }];
  const forward = RANK[status] > RANK[e.status];
  return await db.engagements.update(e.id, { status: forward ? status : e.status, history });
}

export type StoreBlob = (key: string, bytes: Uint8Array) => void | Promise<void>;

export async function handleEsignWebhook(
  db: Db,
  provider: EsignProvider,
  rawBody: string,
  headers: Record<string, string>,
  now = new Date(),
  storeBlob: StoreBlob = () => undefined,
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
    const e = await db.engagements.get(ev.engagementId);
    if (!e || e.status === "voided") continue;
    if (ev.status === "failed") {
      await audit(db, "system", { action: "engagement.payment_failed", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { paymentId: ev.paymentId }, at: now });
      await systemNote(db, e.leadId, "Payment attempt failed", ev.at);
      processed++;
      continue;
    }
    if (seen(e, "paid")) continue;
    await applyStatus(db, e, "paid", ev.at);
    const lead = await leadFor(db, e);
    await advanceStage(db, lead, "paid", "system", ev.at);
    // Analytics only: the fee engine decides if the amount is billable under the firm structure.
    await recordBillableEvent(db, { type: "fee_collected", occurredAt: ev.at, state: lead.state, lawyerId: e.lawyerId, amountCents: e.feeCents });
    await systemNote(db, e.leadId, "Engagement fee received", ev.at);
    await audit(db, "system", { action: "engagement.paid", resourceType: "engagement", resourceId: e.id, leadId: e.leadId, detail: { status: "paid", paymentId: ev.paymentId }, at: now });
    processed++;
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
