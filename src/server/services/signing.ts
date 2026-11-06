/**
 * Built-in e-sign: what the client sees on /client/sign/[engagementId] and how a signature is recorded.
 *
 * A signature counts only when the signer (1) is signed in as themselves and signs their own slot (the lead's
 * client, or the second client from their own login; see coSigner.ts), (2) agreed to use
 * electronic records after reading the consumer disclosure, (3) typed their name as printed on the agreement,
 * (4) ticked "I intend to sign", and (5) signed exactly the document the attorney approved: the page posts back
 * the document hash it showed, and the server recomputes it from the stored letter and PDF bytes. Each
 * signature is an insert-only row. For a couple each spouse signs from their own login; when the last signature is in, a
 * signed "signed" event goes through handleEsignWebhook, the same path external providers use, which moves
 * the lead to retainer_signed, stores the signed copy and starts the payment plan.
 */
import { randomUUID } from "node:crypto";
import { packages as TIERS } from "@/config/firm";
import { ESIGN_CONSENT_VERSION } from "@/lib/esignConsent";
import { clientSummary, money } from "@/lib/retainerPlan";
import { audit } from "@/server/audit/log";
import { assertCan, leadAccess, ForbiddenError } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import type { BuiltinEsignProvider } from "@/server/esign/builtin";
import { signedCopyInput } from "@/server/esign/builtin";
import type { PaymentProvider } from "@/server/esign/payments";
import type { Notifier } from "@/server/notify";
import { documentHash, getEngagement, systemNote } from "@/server/services/engagementShared";
import { handleEsignWebhook, PACKAGES } from "@/server/services/engagement";
import { MATTER_LABELS } from "@/server/services/leads";
import type { DeviceInfo } from "@/server/services/planAccount";
import { firstNameOf, maskEmail, signerSlotOf } from "@/server/services/coSigner";
import { getBlob, putBlob } from "@/server/storage/blobs";
import type { Actor, Engagement, Lead, SignatureRecord } from "@/server/types";

export interface Signer {
  role: SignatureRecord["signerRole"];
  name: string;
  firstName: string;
  /** The person who signs this slot; for the second client, absent until their email is on file */
  personId?: string;
  signed?: { typedName: string; signedAt: string };
}

export type SigningState = "ready" | "partly_signed" | "signed" | "voided" | "not_sent";

export interface SigningView {
  engagementId: string;
  leadId: string;
  state: SigningState;
  firmName: string;
  attorneyName: string;
  /** Plain-language summary for the top of the page */
  summary: { hiring: string; includes: string[]; fee: string; payment: string[]; next: string[] };
  letter: string;
  attachment?: { name: string; sizeBytes: number; sha256: string };
  documentSha256: string;
  signers: Signer[];
  /** The slot the signed-in person may sign (their own, and only theirs). Absent for staff. */
  mySlot?: Signer["role"];
  /** Joint representation: where the second client's own link goes ("r•••@example.com"), once on file */
  spouseEmailHint?: string;
  /** "Waiting for Riley": the first names of signers still to sign */
  waitingFor: string[];
  /** A payment link waiting for the client, once signed */
  paymentLinkUrl?: string;
  countersigned: boolean;
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s'-]/g, " ").replace(/\s+/g, " ").trim();
export const namesMatch = (typed: string, expected: string) => norm(typed).length > 1 && norm(typed) === norm(expected);

/**
 * The client on the case, the second client named on this engagement (who sees only this agreement), or staff
 * with full access. `slot` is the signature slot the actor may sign, if any.
 */
async function loadForClient(db: Db, actor: Actor, engagementId: string, now: Date): Promise<{ e: Engagement; lead: Lead; slot?: Signer["role"] }> {
  const e = await getEngagement(db, engagementId);
  const lead = await db.leads.get(e.leadId);
  if (!lead) throw new Error("Case not found");
  const slot = signerSlotOf(actor, lead, e);
  const access = slot === "spouse" ? "client" : leadAccess(actor, lead, await db.assignments.list(undefined, { leadId: lead.id }), now);
  assertCan(access === "client" || access === "full", "This agreement is not yours to open");
  if (access === "client" && (e.status === "draft" || e.status === "approved")) throw new ForbiddenError("This agreement has not been sent yet");
  return { e, lead, slot };
}

async function signersFor(db: Db, e: Engagement, lead: Lead): Promise<Signer[]> {
  const person = await db.persons.get(lead.personId);
  const done = await db.signatures.list(undefined, { engagementId: e.id });
  const signer = (role: Signer["role"], name: string, personId?: string): Signer => {
    const s = done.find((d) => d.signerRole === role);
    return { role, name, firstName: firstNameOf(name), personId, ...(s ? { signed: { typedName: s.typedName, signedAt: s.signedAt } } : {}) };
  };
  const out = [signer("client", person ? `${person.firstName} ${person.lastName}`.trim() : "Client", lead.personId)];
  if (e.spouseName) out.push(signer("spouse", e.spouseName, e.spousePersonId));
  return out;
}

/**
 * The recomputed document hash. Throws if the stored PDF no longer matches what the attorney approved, or the
 * letter changed after approval, so a signature can never bind to something other than what was approved.
 */
async function currentDocumentHash(service: Db, e: Engagement): Promise<{ letterSha256: string; documentSha256: string; attachmentSha256?: string }> {
  let attachmentSha256: string | undefined;
  if (e.attachment) {
    const stored = await getBlob(service, e.attachment.storageKey);
    if (!stored || stored.blob.sha256 !== e.attachment.sha256) throw new Error("The attached agreement could not be verified. Please call the office.");
    attachmentSha256 = stored.blob.sha256;
  }
  const h = documentHash(e.letter ?? "", attachmentSha256);
  if (!e.documentSha256 || h.documentSha256 !== e.documentSha256) throw new Error("This agreement changed after your attorney approved it. Please call the office.");
  return { ...h, attachmentSha256 };
}

function stateOf(e: Engagement, signers: Signer[]): SigningState {
  if (e.status === "voided") return "voided";
  if (e.status === "draft" || e.status === "approved") return "not_sent";
  if (signers.every((s) => s.signed) || ["signed", "paid", "countersigned"].includes(e.status)) return "signed";
  return signers.some((s) => s.signed) ? "partly_signed" : "ready";
}

/** What the signing page shows. `service` is the service-role store, read after the access check. */
export async function signingView(service: Db, actor: Actor, engagementId: string, now = new Date()): Promise<SigningView> {
  const { e, lead, slot } = await loadForClient(service, actor, engagementId, now);
  const { firmName, attorneyName } = await signedCopyInput(service, e);
  const spouse = e.spousePersonId ? await service.persons.get(e.spousePersonId) : undefined;
  const signers = await signersFor(service, e, lead);
  const tier = e.packageSelection ? TIERS.find((t) => t.id === e.packageSelection!.tierId) : undefined;
  const pkg = PACKAGES[e.packageId];
  const packageName = e.packageSelection ? `${e.packageSelection.tierName} package` : (pkg?.name ?? e.packageId);
  const payment = e.packageSelection && e.paymentPlan
    ? clientSummary(e.packageSelection, e.paymentPlan).lines.filter((l) => !/^Total flat fee/.test(l))
    : [`${money(e.feeCents)} in one payment, through a secure payment link straight to the firm.`];
  const payments = await service.payments.list(undefined, { engagementId: e.id });
  const pending = payments.filter((p) => p.status === "pending" && p.linkUrl).sort((a, b) => (a.installmentNo ?? 0) - (b.installmentNo ?? 0))[0];
  return {
    engagementId: e.id,
    leadId: lead.id,
    state: stateOf(e, signers),
    firmName,
    attorneyName,
    summary: {
      hiring: `${firmName} will help you with ${MATTER_LABELS[lead.matterType].toLowerCase()}: the ${packageName}. Your attorney is ${attorneyName}.`,
      includes: tier?.includes ?? pkg?.includes ?? [],
      fee: `${money(e.feeCents)} flat fee. It does not go up if the work takes longer.`,
      payment,
      next: [
        e.spouseName ? "Each of you signs from your own link and sign-in, so each signature is your own." : "You sign below.",
        `${attorneyName} countersigns, and you can download your copy right away.`,
        e.paymentPlan || payments.length ? "You get a secure link to pay the firm directly." : "The office sends you a secure payment link.",
        "Your attorney starts preparing your documents and stays in touch through your case page.",
      ],
    },
    letter: e.letter ?? "",
    attachment: e.attachment ? { name: e.attachment.name, sizeBytes: e.attachment.sizeBytes, sha256: e.attachment.sha256 } : undefined,
    documentSha256: e.documentSha256 ?? "",
    signers,
    mySlot: slot,
    spouseEmailHint: spouse?.email ? maskEmail(spouse.email) : undefined,
    waitingFor: e.status === "voided" ? [] : signers.filter((s) => !s.signed).map((s) => s.firstName),
    paymentLinkUrl: pending?.linkUrl,
    countersigned: e.status === "countersigned",
  };
}

/** The client opened the agreement: recorded once, through the same event path as an external provider's "viewed". */
export async function markViewed(service: Db, actor: Actor, engagementId: string, provider: BuiltinEsignProvider, now = new Date()): Promise<void> {
  if (actor.role !== "client") return;
  const { e } = await loadForClient(service, actor, engagementId, now);
  if (e.provider !== "builtin" || e.status !== "sent" || !e.providerEnvelopeId) return;
  const ev = provider.eventFor(e.providerEnvelopeId, "viewed", now);
  await handleEsignWebhook(service, provider, ev.rawBody, ev.headers, now);
}

export interface SignInput {
  engagementId: string;
  signerRole: SignatureRecord["signerRole"];
  typedName: string;
  /** "I agree to use electronic records and signatures" */
  consent: boolean;
  /** "I intend to sign" */
  intent: boolean;
  /** The document hash the page showed */
  documentSha256: string;
  device?: DeviceInfo;
}

export class SigningError extends Error {}

/**
 * Records one signature. `service` is the service-role store (signature rows and blobs are written by the server
 * after this check). Returns whether every required signer has now signed.
 */
export async function signEngagement(
  service: Db,
  actor: Actor,
  input: SignInput,
  provider: BuiltinEsignProvider,
  opts: { payments?: PaymentProvider; notifier?: Notifier } = {},
  now = new Date(),
): Promise<{ complete: boolean; signature: SignatureRecord }> {
  const { e, lead, slot } = await loadForClient(service, actor, input.engagementId, now);
  if (actor.role !== "client" || !slot || !actor.personId) throw new ForbiddenError("Only the client signs their agreement");
  // Each person signs only their own slot, from their own sign-in: one person can never sign for both.
  if (input.signerRole !== slot) {
    throw new ForbiddenError(slot === "client" && e.spouseName
      ? `Only ${firstNameOf(e.spouseName)} can sign for ${firstNameOf(e.spouseName)}, from their own link.`
      : "You can only sign for yourself.");
  }
  if (e.provider !== "builtin" || !e.providerEnvelopeId) throw new SigningError("This agreement is signed through another service. Use the link in your email.");
  if (e.status !== "sent" && e.status !== "viewed") throw new SigningError(e.status === "voided" ? "This agreement was withdrawn. Please call the office." : "This agreement is already signed.");
  if (!input.consent) throw new SigningError("Please agree to use electronic records and signatures first, or ask the office for a paper copy.");
  if (!input.intent) throw new SigningError("Please tick the box to confirm you intend to sign.");
  const signers = await signersFor(service, e, lead);
  const me = signers.find((s) => s.role === slot);
  if (!me) throw new SigningError("There is no such signer on this agreement.");
  if (me.personId !== actor.personId) throw new ForbiddenError("You can only sign for yourself.");
  if (me.signed) throw new SigningError(`${me.name} has already signed.`);
  if (!namesMatch(input.typedName, me.name)) throw new SigningError(`Type the full name as it appears on the agreement: ${me.name}`);
  const hash = await currentDocumentHash(service, e);
  if (input.documentSha256 !== hash.documentSha256) throw new SigningError("The agreement was updated since you opened it. Please reload the page and read it again.");

  const at = now.toISOString();
  const signature = await service.signatures.insert({
    id: randomUUID(),
    engagementId: e.id,
    leadId: lead.id,
    firmId: e.firmId,
    signerRole: me.role,
    expectedName: me.name,
    typedName: input.typedName.trim().slice(0, 200),
    signedByUserId: actor.userId,
    signerPersonId: actor.personId,
    signedAt: at,
    ipPrefix: input.device?.ipPrefix,
    userAgent: input.device?.userAgent,
    letterSha256: hash.letterSha256,
    attachmentSha256: hash.attachmentSha256,
    documentSha256: hash.documentSha256,
    consentVersion: ESIGN_CONSENT_VERSION,
    consentAt: at,
    intent: true,
  });
  await audit(service, actor, {
    action: "engagement.signature",
    resourceType: "engagement",
    resourceId: e.id,
    leadId: lead.id,
    detail: { signerRole: me.role, signatureId: signature.id, documentSha256: hash.documentSha256, consentVersion: ESIGN_CONSENT_VERSION },
    at: now,
  });
  await systemNote(service, lead.id, me.role === "spouse" ? "Engagement signed by the second client" : "Engagement signed by the client", at, actor.userId);

  const complete = signers.every((s) => s.role === me.role || s.signed);
  if (!complete) return { complete, signature };

  const ev = provider.eventFor(e.providerEnvelopeId, "signed", now);
  const store = (key: string, bytes: Uint8Array) =>
    putBlob(service, { key, bytes, contentType: "text/html", createdBy: "system", firmId: e.firmId, leadId: lead.id }, now).then(() => undefined);
  await handleEsignWebhook(service, provider, ev.rawBody, ev.headers, now, store, opts.payments);
  await notifyAttorney(service, opts.notifier, e, lead);
  return { complete, signature };
}

/** Tells the assigned attorney. Staff alerts carry no client names or case facts, only a link. */
async function notifyAttorney(db: Db, notifier: Notifier | undefined, e: Engagement, lead: Lead): Promise<void> {
  if (!notifier) return;
  const lawyer = await db.lawyers.get(e.lawyerId);
  const user = (await db.users.list(undefined, { lawyerId: e.lawyerId }))[0];
  try {
    await notifier.send(
      { userId: user?.id ?? e.lawyerId, email: lawyer?.email },
      { subject: "A retainer was signed", text: "A client signed their engagement agreement. Countersign it from the case page.", link: `/portal/leads/${lead.id}` },
    );
  } catch (err) {
    console.warn("retainer signed: attorney notification failed", { error: err instanceof Error ? err.message : String(err) });
  }
}
