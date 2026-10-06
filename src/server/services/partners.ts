/**
 * Referral partners: records, gift log, partner-submitted referrals, ref-code attribution, the client release and
 * what the partner may be told. Tracking only. Nothing here pays, credits or rewards a partner for a referral
 * (ABA Model Rule 7.2(b), 5.4(a)); the gift gate exists to keep it that way. Client facts never go to a partner
 * without a release (Rule 1.6).
 */
import { randomUUID } from "node:crypto";
import { servedStates } from "@/config/firm";
import { buildConsentRecord } from "@/lib/consent";
import type { LeadRecord } from "@/lib/crm";
import {
  DISCLOSURE_VERSION,
  FEEDBACK_LABELS,
  NO_RELEASE_MESSAGE,
  canMoveRelease,
  evaluateGift,
  feedbackStatusForStage,
  giftLimits,
  normalizeRef,
  partnerInputSchema,
  refCodeForSlug,
  type FeedbackStatus,
  type GiftLimits,
  type PartnerInput,
  type PartnerReferralInput,
  type ReleaseStatus,
} from "@/lib/partners";
import { scoreLead } from "@/lib/scoring";
import { audit } from "@/server/audit/log";
import { assertCan, canOnPartner } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { ingestLead } from "@/server/services/leads";
import type { Actor, Lead, Partner, PartnerGift, PartnerReferral } from "@/server/types";

// ---------------------------------------------------------------------------
// Partner records
// ---------------------------------------------------------------------------

function checkAgreement(p: Pick<Partner, "reciprocalAgreementOnFile" | "agreementNonexclusive">) {
  if (p.reciprocalAgreementOnFile && !p.agreementNonexclusive) {
    throw new Error("A reciprocal referral agreement must be non-exclusive (ABA Model Rule 7.2(b)(4)). Confirm it is non-exclusive or do not record it as on file.");
  }
}

export async function createPartner(db: Db, actor: Actor, raw: unknown, now = new Date()): Promise<Partner> {
  assertCan(actor.role === "platform_admin" || actor.role === "firm_admin", "Only admins manage referral partners");
  const input: PartnerInput = partnerInputSchema.parse(raw);
  // A firm admin's partners always belong to their own firm.
  const firmId = actor.role === "firm_admin" ? actor.firmId : input.firmId;
  assertCan(canOnPartner(actor, "manage", { firmId }), "You cannot manage partners of another firm");
  const refCode = input.refCode ?? refCodeForSlug(input.slug);
  if ((await db.partners.list(undefined, { slug: input.slug })).length) throw new Error("That page slug is already in use");
  if ((await db.partners.list(undefined, { refCode })).length) throw new Error("That ref code is already in use");
  const partner: Partner = {
    id: randomUUID(),
    slug: input.slug,
    name: input.name,
    org: input.org,
    type: input.type,
    refCode,
    status: input.status,
    ownerId: input.ownerId,
    firmId,
    createdAt: now.toISOString(),
    policySignedDate: input.policySignedDate,
    reciprocalAgreementOnFile: input.reciprocalAgreementOnFile,
    agreementNonexclusive: input.agreementNonexclusive,
    notes: input.notes,
  };
  checkAgreement(partner);
  await db.partners.insert(partner);
  await audit(db, actor, { action: "partner.create", resourceType: "partner", resourceId: partner.id, detail: { slug: partner.slug, type: partner.type }, at: now });
  return partner;
}

export type PartnerPatch = Partial<Pick<Partner, "status" | "ownerId" | "policySignedDate" | "reciprocalAgreementOnFile" | "agreementNonexclusive" | "notes">>;

export async function updatePartner(db: Db, actor: Actor, id: string, patch: PartnerPatch, now = new Date()): Promise<Partner> {
  const partner = await db.partners.get(id);
  assertCan(!!partner && canOnPartner(actor, "manage", partner), "You do not have access to this partner");
  const next = { ...partner!, ...patch };
  checkAgreement(next);
  const updated = await db.partners.update(id, patch);
  await audit(db, actor, { action: "partner.update", resourceType: "partner", resourceId: id, detail: { fields: Object.keys(patch) }, at: now });
  return updated;
}

/** Everything the staff views need for one partner, or undefined when the actor may not see it. */
export async function getPartnerFor(db: Db, actor: Actor, id: string): Promise<Partner | undefined> {
  const partner = await db.partners.get(id);
  return partner && canOnPartner(actor, "view", partner) ? partner : undefined;
}

export async function listPartnersFor(db: Db, actor: Actor): Promise<Partner[]> {
  assertCan(actor.role === "platform_admin" || actor.role === "firm_admin", "Only admins see referral partners");
  return (await db.partners.list((p) => canOnPartner(actor, "view", p))).sort((a, b) => a.org.localeCompare(b.org));
}

/** The only partner fields a public page may show. */
export interface PublicPartner {
  slug: string;
  name: string;
  org: string;
  type: Partner["type"];
  refCode: string;
}

/** Public lookup for /partners/[slug]. Only partners in good standing have a page. */
export async function findPublicPartner(db: Db, slug: string): Promise<PublicPartner | undefined> {
  const p = (await db.partners.list(undefined, { slug }))[0];
  if (!p || p.status !== "active") return undefined;
  return { slug: p.slug, name: p.name, org: p.org, type: p.type, refCode: p.refCode };
}

// ---------------------------------------------------------------------------
// Gift log and the thing-of-value gate
// ---------------------------------------------------------------------------

export class GiftBlockedError extends Error {
  constructor(public reasons: string[]) {
    super(`Gift not logged. ${reasons.join(" ")}`);
    this.name = "GiftBlockedError";
  }
}

export interface GiftRequest {
  date: string;
  description: string;
  valueCents: number;
  tiedToReferral: boolean;
  thingOfValue: boolean;
  note?: string;
}

const DAY = 86_400_000;

/**
 * Runs the gate, then logs the gift. A gift tied to a referral, or a payment or other thing of value, is refused and not
 * stored (the attempt is audited without the description). A nominal gift over a limit, or soon after a referral, is
 * stored as "flagged" for the attorney to review.
 */
export async function logGift(
  db: Db,
  actor: Actor,
  partnerId: string,
  req: GiftRequest,
  now = new Date(),
  limits: GiftLimits = giftLimits(),
): Promise<PartnerGift> {
  const partner = await db.partners.get(partnerId);
  assertCan(!!partner && canOnPartner(actor, "manage", partner), "You do not have access to this partner");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date)) throw new Error("Enter the gift date as YYYY-MM-DD");
  if (!req.description.trim()) throw new Error("Describe the gift");
  if (!Number.isInteger(req.valueCents) || req.valueCents < 0) throw new Error("Enter the value in dollars");

  const year = req.date.slice(0, 4);
  const gifts = await db.partnerGifts.list((g) => g.date.startsWith(year), { partnerId });
  const ytdCents = gifts.reduce((sum, g) => sum + g.valueCents, 0);
  const referrals = await db.partnerReferrals.list(undefined, { partnerId });
  const latest = referrals.map((r) => Date.parse(r.createdAt)).sort((a, b) => b - a)[0];
  const daysSinceReferral = latest === undefined ? undefined : Math.max(0, (Date.parse(`${req.date}T12:00:00Z`) - latest) / DAY);

  const verdict = evaluateGift({ valueCents: req.valueCents, tiedToReferral: req.tiedToReferral, thingOfValue: req.thingOfValue, ytdCents, daysSinceReferral }, limits);
  if (verdict.verdict === "blocked") {
    await audit(db, actor, {
      action: "partner.gift.blocked",
      resourceType: "partner",
      resourceId: partnerId,
      detail: { tiedToReferral: req.tiedToReferral, thingOfValue: req.thingOfValue, valueCents: req.valueCents },
      at: now,
    });
    throw new GiftBlockedError(verdict.reasons);
  }
  const gift: PartnerGift = {
    id: randomUUID(),
    partnerId,
    date: req.date,
    description: req.description.trim(),
    valueCents: req.valueCents,
    status: verdict.verdict === "flagged" ? "flagged" : "ok",
    flags: verdict.reasons,
    loggedBy: actor.userId,
    reviewNote: req.note?.trim() || undefined,
  };
  await db.partnerGifts.insert(gift);
  await audit(db, actor, {
    action: "partner.gift.log",
    resourceType: "partner",
    resourceId: partnerId,
    detail: { giftId: gift.id, valueCents: gift.valueCents, status: gift.status },
    at: now,
  });
  return gift;
}

// ---------------------------------------------------------------------------
// Referrals: partner form and ?ref= attribution
// ---------------------------------------------------------------------------

export const PARTNER_SEGMENT = "partner_referral";

async function partnerByRef(db: Db, refCode: string): Promise<Partner | undefined> {
  return (await db.partners.list(undefined, { refCode }))[0];
}

/**
 * A visitor who arrived through a partner's ?ref= link and then became a lead. Known codes are attributed:
 * the lead is tagged and a referral row (no client consent, no release) is created. Unknown codes are ignored.
 * Never throws: attribution must not lose the lead.
 */
export async function attributeLead(db: Db, lead: Lead, rawRef: string | undefined, now = new Date()): Promise<PartnerReferral | undefined> {
  const ref = normalizeRef(rawRef);
  if (!ref) return undefined;
  const partner = await partnerByRef(db, ref);
  if (!partner) return undefined;
  const referral: PartnerReferral = {
    id: randomUUID(),
    partnerId: partner.id,
    refCode: partner.refCode,
    leadId: lead.id,
    createdAt: now.toISOString(),
    origin: "ref_link",
    clientConsent: false,
    disclosureGiven: false,
    releaseStatus: "none",
    valueLinked: "unanswered",
  };
  await db.partnerReferrals.insert(referral);
  await audit(db, "system", { action: "partner.referral.attributed", resourceType: "partner", resourceId: partner.id, leadId: lead.id, detail: { origin: "ref_link" }, at: now });
  return referral;
}

/** The segment tags a lead gets for a ref code, so the funnel report can group by partner. Empty for unknown codes. */
export async function partnerSegments(db: Db, rawRef: string | undefined): Promise<string[]> {
  const ref = normalizeRef(rawRef);
  const partner = ref ? await partnerByRef(db, ref) : undefined;
  return partner ? [PARTNER_SEGMENT, `partner:${partner.refCode}`] : [];
}

export class ConsentRequiredError extends Error {
  constructor() {
    super("Confirm that the person agreed to be referred before sending the referral");
    this.name = "ConsentRequiredError";
  }
}

export interface ReferralContext {
  ip: string | null;
  userAgent: string | null;
  pageUrl: string;
}

/**
 * A partner's referral of a client. Requires the partner's confirmation that the client agreed (clientConsent);
 * without it nothing is stored. Creates a portal lead tagged with the partner ref plus the referral row.
 * The lead gets no automated marketing: the person has not signed up for anything themselves.
 */
export async function submitPartnerReferral(
  db: Db,
  partner: Pick<Partner, "id" | "refCode" | "status" | "slug">,
  input: Pick<PartnerReferralInput, "firstName" | "lastName" | "email" | "phone" | "state"> & { clientConsent: boolean },
  ctx: ReferralContext,
  now = new Date(),
): Promise<{ lead: Lead; referral: PartnerReferral; record: LeadRecord }> {
  if (input.clientConsent !== true) throw new ConsentRequiredError();
  if (partner.status !== "active") throw new Error("This partner page is not accepting referrals");
  const record: LeadRecord = {
    id: randomUUID(),
    receivedAt: now.toISOString(),
    contact: { firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone, state: input.state, county: undefined, language: "English" },
    contactMethod: input.phone ? "phone" : "email",
    goals: undefined,
    answers: {},
    score: scoreLead({ state: input.state, servedStates: servedStates(), answers: {}, smsConsent: false, capture: { tool: "intake" } }),
    segments: [PARTNER_SEGMENT, `partner:${partner.refCode}`],
    source: { landingPage: ctx.pageUrl, partnerRef: partner.refCode },
    capture: { tool: "intake", result: { partnerReferral: true } },
    priorTools: [],
    // The referred person has not seen our notices yet, so nothing is marked as acknowledged and no text consent is claimed.
    consent: buildConsentRecord({ smsConsent: false, acknowledgedNoRelationship: false, pageUrl: ctx.pageUrl, ip: ctx.ip, userAgent: ctx.userAgent, now }),
  };
  const lead = await ingestLead(db, record, now, { skipPartnerAttribution: true });
  const referral: PartnerReferral = {
    id: randomUUID(),
    partnerId: partner.id,
    refCode: partner.refCode,
    leadId: lead.id,
    createdAt: now.toISOString(),
    origin: "partner_form",
    clientConsent: true,
    disclosureGiven: false,
    releaseStatus: "none",
    valueLinked: "unanswered",
  };
  await db.partnerReferrals.insert(referral);
  await audit(db, "system", { action: "partner.referral.submit", resourceType: "partner", resourceId: partner.id, leadId: lead.id, detail: { origin: "partner_form" }, at: now });
  return { lead, referral, record };
}

// ---------------------------------------------------------------------------
// Disclosure, release and the value question
// ---------------------------------------------------------------------------

async function referralFor(db: Db, actor: Actor, id: string, action: "view" | "manage"): Promise<PartnerReferral> {
  const referral = await db.partnerReferrals.get(id);
  const partner = referral ? await db.partners.get(referral.partnerId) : undefined;
  assertCan(!!referral && !!partner && canOnPartner(actor, action, partner), "You do not have access to this referral");
  return referral!;
}

/** The firm records that the client was given the Rule 7.2(b)(4) disclosure (client-disclosure.md, block B). */
export async function setDisclosureGiven(db: Db, actor: Actor, referralId: string, given: boolean, now = new Date()): Promise<PartnerReferral> {
  const r = await referralFor(db, actor, referralId, "manage");
  const next = await db.partnerReferrals.update(referralId, {
    disclosureGiven: given,
    disclosureAt: given ? now.toISOString() : undefined,
    disclosureVersion: given ? DISCLOSURE_VERSION : undefined,
  });
  await audit(db, actor, { action: "partner.disclosure", resourceType: "partner", resourceId: r.partnerId, leadId: r.leadId, detail: { referralId, given, version: given ? DISCLOSURE_VERSION : null }, at: now });
  return next;
}

/**
 * Moves the client's release (client-disclosure.md, block E) between none, requested, granted and revoked. Granted means a
 * signed release is on file. Revoking stops all feedback to the partner at once; what was shared earlier is not undone.
 */
export async function setReleaseStatus(db: Db, actor: Actor, referralId: string, to: ReleaseStatus, now = new Date()): Promise<PartnerReferral> {
  const r = await referralFor(db, actor, referralId, "manage");
  if (r.releaseStatus === to) return r;
  if (!canMoveRelease(r.releaseStatus, to)) throw new Error(`A release cannot go from ${r.releaseStatus} to ${to}`);
  const next = await db.partnerReferrals.update(referralId, { releaseStatus: to, releaseUpdatedAt: now.toISOString(), releaseUpdatedBy: actor.userId });
  await audit(db, actor, { action: "partner.release", resourceType: "partner", resourceId: r.partnerId, leadId: r.leadId, detail: { referralId, from: r.releaseStatus, to }, at: now });
  return next;
}

/**
 * The required prompt on every partner-sourced matter: "Is anything of value linked to this referral?" The expected answer
 * is No. A Yes needs a note, blocks closing the matter and is flagged for the attorney.
 */
export async function answerValueQuestion(db: Db, actor: Actor, referralId: string, linked: boolean, note: string | undefined, now = new Date()): Promise<PartnerReferral> {
  const r = await referralFor(db, actor, referralId, "manage");
  if (linked && !note?.trim()) throw new Error("Describe what is linked to the referral so the attorney can review it");
  const next = await db.partnerReferrals.update(referralId, { valueLinked: linked ? "yes" : "no", valueNote: linked ? note!.trim() : undefined });
  await audit(db, actor, { action: linked ? "partner.value_linked.flag" : "partner.value_linked.clear", resourceType: "partner", resourceId: r.partnerId, leadId: r.leadId, detail: { referralId }, at: now });
  return next;
}

/**
 * Called before a matter is closed. A partner-sourced matter cannot close until the value question is answered No;
 * a Yes holds it for the attorney (client-disclosure.md, section F).
 */
export async function assertValueQuestionClear(db: Db, leadId: string): Promise<void> {
  const referrals = await db.partnerReferrals.list(undefined, { leadId });
  const open = referrals.find((r) => r.valueLinked !== "no");
  if (!open) return;
  throw new Error(
    open.valueLinked === "yes"
      ? "This matter cannot be closed: something of value is linked to the partner referral. The attorney must review it (Rule 7.2(b))."
      : 'Answer "Is anything of value linked to this referral?" before closing this partner-sourced matter.',
  );
}

// ---------------------------------------------------------------------------
// What the partner may be told
// ---------------------------------------------------------------------------

export interface PartnerFeedbackRow {
  referralId: string;
  referredOn: string;
  released: boolean;
  /** Present only while the release is granted */
  status?: FeedbackStatus;
  /** What to tell the partner. Without a release it is only a thank-you. */
  message: string;
}

/**
 * Status feedback for a partner: contacted, consult booked or engaged, and only while release_status is granted. It never
 * carries a name, matter, state, fee or document, and without a release it does not even say whether the person got in
 * touch. Pass the service-role store: a firm admin's own session cannot read leads that are not assigned to their firm.
 */
export async function partnerFeedback(db: Db, partnerId: string): Promise<PartnerFeedbackRow[]> {
  const referrals = (await db.partnerReferrals.list(undefined, { partnerId })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const rows: PartnerFeedbackRow[] = [];
  for (const r of referrals) {
    const base = { referralId: r.id, referredOn: r.createdAt.slice(0, 10) };
    if (r.releaseStatus !== "granted" || !r.leadId) {
      rows.push({ ...base, released: false, message: NO_RELEASE_MESSAGE });
      continue;
    }
    const lead = await db.leads.get(r.leadId);
    const status = lead ? feedbackStatusForStage(lead.stage) : undefined;
    rows.push({ ...base, released: true, status, message: status ? FEEDBACK_LABELS[status] : "Referral received" });
  }
  return rows;
}

export interface PartnerSummary {
  referralsReceived: number;
  lastReferralDate?: string;
  /** Counted from released referrals only (tracker column engaged_count_release_only) */
  consultsBooked: number;
  engaged: number;
  releasesGranted: number;
  disclosureMissing: number;
  giftsYtdCents: number;
  flaggedGifts: number;
}

export async function partnerSummary(db: Db, serviceDb: Db, partnerId: string, now = new Date()): Promise<PartnerSummary> {
  const referrals = await db.partnerReferrals.list(undefined, { partnerId });
  const feedback = await partnerFeedback(serviceDb, partnerId);
  const gifts = await db.partnerGifts.list(undefined, { partnerId });
  const year = String(now.getUTCFullYear());
  const ytd = gifts.filter((g) => g.date.startsWith(year));
  return {
    referralsReceived: referrals.length,
    lastReferralDate: referrals.map((r) => r.createdAt.slice(0, 10)).sort().at(-1),
    consultsBooked: feedback.filter((f) => f.status === "consult_booked" || f.status === "engaged").length,
    engaged: feedback.filter((f) => f.status === "engaged").length,
    releasesGranted: referrals.filter((r) => r.releaseStatus === "granted").length,
    disclosureMissing: referrals.filter((r) => !r.disclosureGiven).length,
    giftsYtdCents: ytd.reduce((s, g) => s + g.valueCents, 0),
    flaggedGifts: gifts.filter((g) => g.status === "flagged").length,
  };
}
