import { beforeEach, describe, expect, it } from "vitest";
import { buildConsentRecord } from "@/lib/consent";
import type { LeadRecord } from "@/lib/crm";
import {
  DEFAULT_GIFT_LIMITS,
  evaluateGift,
  feedbackStatusForStage,
  giftLimits,
  normalizeRef,
  partnerReferralSchema,
  refCodeForSlug,
} from "@/lib/partners";
import { scoreLead } from "@/lib/scoring";
import { verifyAuditChain } from "@/server/audit/log";
import { canOnPartner, can, ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { enrollForNewLead } from "@/server/nurture/scheduler";
import { ingestLead, setStage } from "@/server/services/leads";
import {
  ConsentRequiredError,
  GiftBlockedError,
  answerValueQuestion,
  createPartner,
  findPublicPartner,
  listPartnersFor,
  logGift,
  partnerFeedback,
  partnerSummary,
  setDisclosureGiven,
  setReleaseStatus,
  submitPartnerReferral,
  updatePartner,
} from "@/server/services/partners";
import type { Actor, Partner, Role } from "@/server/types";

const NOW = new Date("2026-10-06T12:00:00Z");
const actor = (role: Role, firmId: string | undefined = "f1"): Actor => ({ userId: `u-${role}`, role, firmId, mfa: true });
const admin = actor("platform_admin", undefined);
const firmAdmin = actor("firm_admin", "f1");
const otherFirmAdmin = { ...actor("firm_admin", "f2"), userId: "u-fa2" };
const ctx = { ip: null, userAgent: null, pageUrl: "/partners/example-cpa" };
const person = { firstName: "Maria", lastName: "Quintanilla", email: "maria.q@example.com", phone: "5125550123", state: "TX" as const };

let db: Db;
let partner: Partner;

beforeEach(async () => {
  db = createMemoryDb();
  partner = await createPartner(db, firmAdmin, { slug: "example-cpa", name: "Jordan Example", org: "Example CPA PLLC", type: "cpa", status: "active" }, NOW);
});

function webLead(id: string, ref?: string): LeadRecord {
  return {
    id,
    receivedAt: NOW.toISOString(),
    contact: { firstName: "Ana", lastName: "Lee", email: `${id}@example.com`, phone: "", state: "TX", language: "English" },
    contactMethod: "email",
    answers: {},
    score: scoreLead({ state: "TX", servedStates: ["TX"], answers: {}, smsConsent: false }),
    segments: [],
    source: ref ? { partnerRef: ref } : {},
    consent: buildConsentRecord({ smsConsent: false, acknowledgedNoRelationship: true, pageUrl: "/", ip: null, userAgent: null }),
    capture: { tool: "plan_finder" },
    priorTools: [],
  } as LeadRecord;
}

describe("partner records", () => {
  it("builds the ref code from the slug and keeps slug and code unique", async () => {
    expect(partner.refCode).toBe(refCodeForSlug("example-cpa"));
    expect(partner.firmId).toBe("f1"); // a firm admin's partners always belong to their firm
    await expect(createPartner(db, firmAdmin, { slug: "example-cpa", name: "x", org: "y", type: "cpa" })).rejects.toThrow(/slug/);
    await expect(createPartner(db, firmAdmin, { slug: "other", refCode: "ref-example-cpa", name: "x", org: "y", type: "cpa" })).rejects.toThrow(/ref code/);
    await expect(createPartner(db, firmAdmin, { slug: "Bad Slug!", name: "x", org: "y", type: "cpa" })).rejects.toThrow();
  });

  it("refuses an exclusive reciprocal agreement (Rule 7.2(b)(4))", async () => {
    await expect(updatePartner(db, firmAdmin, partner.id, { reciprocalAgreementOnFile: true, agreementNonexclusive: false })).rejects.toThrow(/non-exclusive/);
    const ok = await updatePartner(db, firmAdmin, partner.id, { reciprocalAgreementOnFile: true, agreementNonexclusive: true });
    expect(ok.reciprocalAgreementOnFile).toBe(true);
  });

  it("only active partners have a public page, and it shows no internal fields", async () => {
    const pub = await findPublicPartner(db, "example-cpa");
    expect(pub).toEqual({ slug: "example-cpa", name: "Jordan Example", org: "Example CPA PLLC", type: "cpa", refCode: "ref-example-cpa" });
    await updatePartner(db, firmAdmin, partner.id, { status: "paused", notes: "private" });
    expect(await findPublicPartner(db, "example-cpa")).toBeUndefined();
    expect(await findPublicPartner(db, "nobody")).toBeUndefined();
  });
});

describe("gift gate", () => {
  const base = { valueCents: 1500, tiedToReferral: false, thingOfValue: false, ytdCents: 0 };

  it("allows a nominal gift", () => {
    expect(evaluateGift(base).verdict).toBe("allowed");
  });

  it("blocks anything tied to a referral and explains Rule 7.2(b)", () => {
    const v = evaluateGift({ ...base, valueCents: 100, tiedToReferral: true });
    expect(v.verdict).toBe("blocked");
    expect(v.reasons.join(" ")).toMatch(/7\.2\(b\)/);
    expect(v.reasons.join(" ")).toMatch(/pays nothing for referrals/);
  });

  it("blocks a payment or other thing of value whatever its size", () => {
    const v = evaluateGift({ ...base, valueCents: 1, thingOfValue: true });
    expect(v.verdict).toBe("blocked");
    expect(v.reasons.join(" ")).toMatch(/5\.4/);
  });

  it("flags a gift over the per-gift limit, over the annual limit, or soon after a referral", () => {
    expect(evaluateGift({ ...base, valueCents: DEFAULT_GIFT_LIMITS.perGiftCents + 1 }).verdict).toBe("flagged");
    expect(evaluateGift({ ...base, valueCents: 2000, ytdCents: 4000 }).reasons.join(" ")).toMatch(/annual limit/);
    expect(evaluateGift({ ...base, daysSinceReferral: 3 }).reasons.join(" ")).toMatch(/within 14 days of a referral/);
    expect(evaluateGift({ ...base, daysSinceReferral: 60 }).verdict).toBe("allowed");
  });

  it("reads the limits the attorney configures", () => {
    expect(giftLimits({ PARTNER_GIFT_LIMIT_USD: "40", PARTNER_GIFT_ANNUAL_LIMIT_USD: "100" })).toMatchObject({ perGiftCents: 4000, annualCents: 10000 });
    expect(giftLimits({})).toMatchObject(DEFAULT_GIFT_LIMITS);
    expect(evaluateGift({ ...base, valueCents: 3500 }, giftLimits({ PARTNER_GIFT_LIMIT_USD: "40" })).verdict).toBe("allowed");
  });

  const req = (over: Record<string, unknown> = {}) => ({ date: "2026-10-01", description: "Holiday card and coffee", valueCents: 1500, tiedToReferral: false, thingOfValue: false, ...over });

  it("does not store a blocked gift, and audits the attempt without the description", async () => {
    await expect(logGift(db, firmAdmin, partner.id, req({ tiedToReferral: true, description: "thanks for Maria" }), NOW)).rejects.toBeInstanceOf(GiftBlockedError);
    expect(await db.partnerGifts.list()).toEqual([]);
    const events = await db.audit.list((e) => e.action === "partner.gift.blocked");
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0].detail)).not.toMatch(/Maria/);
  });

  it("logs an ordinary gift and flags one over the limit for review", async () => {
    const ok = await logGift(db, firmAdmin, partner.id, req(), NOW);
    expect(ok.status).toBe("ok");
    const flagged = await logGift(db, firmAdmin, partner.id, req({ valueCents: 9000 }), NOW);
    expect(flagged.status).toBe("flagged");
    expect(flagged.flags.join(" ")).toMatch(/Over the per-gift limit/);
    const s = await partnerSummary(db, db, partner.id, NOW);
    expect(s).toMatchObject({ giftsYtdCents: 10500, flaggedGifts: 1 });
  });

  it("flags a gift dated soon after the partner's referral", async () => {
    await submitPartnerReferral(db, partner, { ...person, clientConsent: true }, ctx, NOW);
    const g = await logGift(db, firmAdmin, partner.id, req({ date: "2026-10-08" }), NOW);
    expect(g.status).toBe("flagged");
    expect(g.flags.join(" ")).toMatch(/referral/);
  });

  it("totals the year across gifts", async () => {
    await logGift(db, firmAdmin, partner.id, req({ valueCents: 2500 }), NOW);
    await logGift(db, firmAdmin, partner.id, req({ valueCents: 2500 }), NOW);
    const third = await logGift(db, firmAdmin, partner.id, req({ valueCents: 1000 }), NOW);
    expect(third.flags.join(" ")).toMatch(/annual limit/);
    // a gift in an earlier year does not count
    const old = await logGift(db, firmAdmin, partner.id, req({ date: "2025-12-20", valueCents: 2500 }), NOW);
    expect(old.status).toBe("ok");
  });

  it("rejects bad input", async () => {
    await expect(logGift(db, firmAdmin, partner.id, req({ date: "yesterday" }), NOW)).rejects.toThrow(/YYYY-MM-DD/);
    await expect(logGift(db, firmAdmin, partner.id, req({ valueCents: -1 }), NOW)).rejects.toThrow();
    await expect(logGift(db, firmAdmin, partner.id, req({ description: " " }), NOW)).rejects.toThrow();
  });
});

describe("referral intake and client consent", () => {
  it("the form schema cannot validate without the consent box", () => {
    const base = { firstName: "Maria", email: "m@example.com", state: "TX" };
    expect(partnerReferralSchema.safeParse(base).success).toBe(false);
    expect(partnerReferralSchema.safeParse({ ...base, clientConsent: false }).success).toBe(false);
    const r = partnerReferralSchema.safeParse({ ...base, clientConsent: true });
    expect(r.success).toBe(true);
  });

  it("stores nothing without consent", async () => {
    await expect(submitPartnerReferral(db, partner, { ...person, clientConsent: false }, ctx, NOW)).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(await db.leads.list()).toEqual([]);
    expect(await db.partnerReferrals.list()).toEqual([]);
    expect(await db.persons.list()).toEqual([]);
  });

  it("refuses a partner that is not active", async () => {
    await updatePartner(db, firmAdmin, partner.id, { status: "do_not_contact" });
    const p = (await db.partners.get(partner.id))!;
    await expect(submitPartnerReferral(db, p, { ...person, clientConsent: true }, ctx, NOW)).rejects.toThrow(/not accepting/);
  });

  it("turns a consented referral into a lead tagged with the partner ref, with disclosure and release not yet given", async () => {
    const { lead, referral } = await submitPartnerReferral(db, partner, { ...person, clientConsent: true }, ctx, NOW);
    expect(lead.segments).toEqual(expect.arrayContaining(["partner_referral", "partner:ref-example-cpa"]));
    expect(lead.source.partnerRef).toBe("ref-example-cpa");
    expect(lead.consent.smsConsent).toBe(false);
    expect(lead.consent.acknowledgedNoRelationship).toBe(false);
    expect(referral).toMatchObject({ origin: "partner_form", clientConsent: true, disclosureGiven: false, releaseStatus: "none", valueLinked: "unanswered", leadId: lead.id });
    // one referral row only: ingestLead must not attribute a second time
    expect(await db.partnerReferrals.list()).toHaveLength(1);
    expect((await db.audit.list((e) => e.action === "partner.referral.submit")).length).toBe(1);
    expect(verifyAuditChain(await db.audit.list())).toEqual({ ok: true });
  });

  it("does not start automated sequences for a person who did not sign up themselves", async () => {
    const { lead } = await submitPartnerReferral(db, partner, { ...person, clientConsent: true }, ctx, NOW);
    expect(await enrollForNewLead(db, lead, NOW)).toEqual([]);
  });
});

describe("?ref= attribution", () => {
  it("normalizes ref codes", () => {
    expect(normalizeRef(" REF-Example-CPA ")).toBe("ref-example-cpa");
    expect(normalizeRef("twitter")).toBeUndefined();
    expect(normalizeRef("ref-")).toBeUndefined();
    expect(normalizeRef(undefined)).toBeUndefined();
  });

  it("tags the lead and records a referral with no consent and no release", async () => {
    const lead = await ingestLead(db, webLead("l1", "ref-example-cpa"), NOW);
    expect(lead.segments).toEqual(expect.arrayContaining(["partner_referral", "partner:ref-example-cpa"]));
    const [r] = await db.partnerReferrals.list();
    expect(r).toMatchObject({ partnerId: partner.id, leadId: "l1", origin: "ref_link", clientConsent: false, releaseStatus: "none" });
    expect((await partnerSummary(db, db, partner.id, NOW)).referralsReceived).toBe(1);
  });

  it("ignores unknown codes and leads without a code", async () => {
    const a = await ingestLead(db, webLead("l1", "ref-nobody"), NOW);
    const b = await ingestLead(db, webLead("l2"), NOW);
    expect(a.segments).not.toContain("partner_referral");
    expect(b.segments).toEqual([]);
    expect(await db.partnerReferrals.list()).toEqual([]);
  });

  it("accepts the ref on the lead submission schema", async () => {
    const { leadSubmissionSchema } = await import("@/lib/lead");
    const parsed = leadSubmissionSchema.safeParse({
      firstName: "A", email: "a@example.com", phone: "5125550100", state: "TX", smsConsent: false, acknowledgedNoRelationship: true,
      source: { partnerRef: "ref-example-cpa" },
    });
    expect(parsed.success && parsed.data.source.partnerRef).toBe("ref-example-cpa");
  });
});

describe("release and feedback to the partner", () => {
  async function referred() {
    const out = await submitPartnerReferral(db, partner, { ...person, clientConsent: true }, ctx, NOW);
    return out;
  }

  it("moves through the release states and rejects impossible moves", async () => {
    const { referral } = await referred();
    await expect(setReleaseStatus(db, firmAdmin, referral.id, "revoked", NOW)).rejects.toThrow(/cannot go from none to revoked/);
    expect((await setReleaseStatus(db, firmAdmin, referral.id, "requested", NOW)).releaseStatus).toBe("requested");
    const granted = await setReleaseStatus(db, firmAdmin, referral.id, "granted", NOW);
    expect(granted).toMatchObject({ releaseStatus: "granted", releaseUpdatedBy: "u-firm_admin" });
    await expect(setReleaseStatus(db, firmAdmin, referral.id, "requested", NOW)).rejects.toThrow();
    expect((await setReleaseStatus(db, firmAdmin, referral.id, "revoked", NOW)).releaseStatus).toBe("revoked");
    expect((await db.audit.list((e) => e.action === "partner.release")).map((e) => e.detail?.to)).toEqual(["requested", "granted", "revoked"]);
  });

  it("gives no status at all without a release, not even that the person got in touch", async () => {
    const { lead } = await referred();
    await setStage(db, "system", lead.id, "consult_booked", NOW);
    const rows = await partnerFeedback(db, partner.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ released: false, message: "Thank you for thinking of us." });
    expect(rows[0].status).toBeUndefined();
  });

  it("shows contacted, consult booked and engaged only while the release is granted", async () => {
    const { lead, referral } = await referred();
    await setReleaseStatus(db, firmAdmin, referral.id, "granted", NOW);
    expect((await partnerFeedback(db, partner.id))[0]).toMatchObject({ released: true, message: "Referral received" });
    await setStage(db, "system", lead.id, "contacted", NOW);
    expect((await partnerFeedback(db, partner.id))[0].status).toBe("contacted");
    await setStage(db, "system", lead.id, "consult_booked", NOW);
    expect((await partnerFeedback(db, partner.id))[0].status).toBe("consult_booked");
    await setStage(db, "system", lead.id, "retainer_signed", NOW);
    expect((await partnerFeedback(db, partner.id))[0]).toMatchObject({ status: "engaged", message: "Engaged" });
    const s = await partnerSummary(db, db, partner.id, NOW);
    expect(s).toMatchObject({ consultsBooked: 1, engaged: 1, releasesGranted: 1 });
  });

  it("stops at once when the release is revoked", async () => {
    const { lead, referral } = await referred();
    await setReleaseStatus(db, firmAdmin, referral.id, "granted", NOW);
    await setStage(db, "system", lead.id, "contacted", NOW);
    await setReleaseStatus(db, firmAdmin, referral.id, "revoked", NOW);
    const row = (await partnerFeedback(db, partner.id))[0];
    expect(row).toMatchObject({ released: false });
    expect(row.status).toBeUndefined();
    expect((await partnerSummary(db, db, partner.id, NOW)).engaged).toBe(0);
  });

  it("never carries case facts", async () => {
    const { lead, referral } = await referred();
    await setReleaseStatus(db, firmAdmin, referral.id, "granted", NOW);
    await setStage(db, "system", lead.id, "retainer_signed", NOW);
    const text = JSON.stringify(await partnerFeedback(db, partner.id));
    expect(text).not.toMatch(/Maria|Quintanilla|example\.com|5125550123|TX|new_plan|estate|fee/i);
    expect(Object.keys((await partnerFeedback(db, partner.id))[0]).sort()).toEqual(["message", "referralId", "referredOn", "released", "status"]);
  });

  it("maps stages to the three milestones only", () => {
    expect(feedbackStatusForStage("new")).toBeUndefined();
    expect(feedbackStatusForStage("conflict_check")).toBe("contacted");
    expect(feedbackStatusForStage("consult_held")).toBe("consult_booked");
    expect(feedbackStatusForStage("drafting")).toBe("engaged");
  });

  it("records the disclosure with its version", async () => {
    const { referral } = await referred();
    const r = await setDisclosureGiven(db, firmAdmin, referral.id, true, NOW);
    expect(r).toMatchObject({ disclosureGiven: true, disclosureAt: NOW.toISOString() });
    expect(r.disclosureVersion).toBeTruthy();
    expect((await partnerSummary(db, db, partner.id, NOW)).disclosureMissing).toBe(0);
  });
});

describe("thing-of-value question on a partner-sourced matter", () => {
  it("blocks closing until it is answered No, and a Yes holds the matter for the attorney", async () => {
    const { lead, referral } = await submitPartnerReferral(db, partner, { ...person, clientConsent: true }, ctx, NOW);
    await expect(setStage(db, "system", lead.id, "plan_complete", NOW)).rejects.toThrow(/Is anything of value linked/);
    await expect(answerValueQuestion(db, firmAdmin, referral.id, true, " ", NOW)).rejects.toThrow(/Describe/);
    await answerValueQuestion(db, firmAdmin, referral.id, true, "Partner asked for lunch in return", NOW);
    await expect(setStage(db, "system", lead.id, "plan_complete", NOW)).rejects.toThrow(/attorney must review/);
    await answerValueQuestion(db, firmAdmin, referral.id, false, undefined, NOW);
    expect((await setStage(db, "system", lead.id, "plan_complete", NOW)).stage).toBe("plan_complete");
  });

  it("does not affect leads that came in some other way", async () => {
    const lead = await ingestLead(db, webLead("plain"), NOW);
    expect((await setStage(db, "system", lead.id, "plan_complete", NOW)).stage).toBe("plan_complete");
  });
});

describe("permissions", () => {
  const roles: Role[] = ["platform_admin", "firm_admin", "attorney", "paralegal", "intake", "marketing", "client"];

  it("only platform and firm admins hold the partner actions", () => {
    for (const role of roles) {
      const expected = role === "platform_admin" || role === "firm_admin";
      expect(can(actor(role), "view_partners"), role).toBe(expected);
      expect(can(actor(role), "manage_partners"), role).toBe(expected);
    }
  });

  it("scopes firm admins to their own firm's partners", () => {
    expect(canOnPartner(admin, "manage", { firmId: "f2" })).toBe(true);
    expect(canOnPartner(admin, "view", { firmId: undefined })).toBe(true);
    expect(canOnPartner(firmAdmin, "manage", { firmId: "f1" })).toBe(true);
    expect(canOnPartner(otherFirmAdmin, "view", { firmId: "f1" })).toBe(false);
    expect(canOnPartner(firmAdmin, "view", { firmId: undefined })).toBe(false);
    expect(canOnPartner(actor("attorney"), "view", { firmId: "f1" })).toBe(false);
  });

  it("every other role is refused by the services", async () => {
    const { referral } = await submitPartnerReferral(db, partner, { ...person, clientConsent: true }, ctx, NOW);
    for (const role of ["attorney", "paralegal", "intake", "marketing", "client"] as Role[]) {
      const a = actor(role);
      await expect(createPartner(db, a, { slug: `s-${role}`, name: "x", org: "y", type: "cpa" }), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listPartnersFor(db, a), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(logGift(db, a, partner.id, { date: "2026-10-01", description: "d", valueCents: 100, tiedToReferral: false, thingOfValue: false }), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setReleaseStatus(db, a, referral.id, "granted"), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setDisclosureGiven(db, a, referral.id, true), role).rejects.toBeInstanceOf(ForbiddenError);
      await expect(answerValueQuestion(db, a, referral.id, false, undefined), role).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("a firm admin cannot touch another firm's partner, referral or gift log", async () => {
    const { referral } = await submitPartnerReferral(db, partner, { ...person, clientConsent: true }, ctx, NOW);
    await expect(updatePartner(db, otherFirmAdmin, partner.id, { status: "paused" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(logGift(db, otherFirmAdmin, partner.id, { date: "2026-10-01", description: "d", valueCents: 100, tiedToReferral: false, thingOfValue: false })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setReleaseStatus(db, otherFirmAdmin, referral.id, "granted")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await listPartnersFor(db, otherFirmAdmin)).toEqual([]);
    expect((await listPartnersFor(db, admin)).map((p) => p.id)).toEqual([partner.id]);
    expect((await listPartnersFor(db, firmAdmin)).map((p) => p.id)).toEqual([partner.id]);
  });

  it("a firm admin cannot create a partner in another firm", async () => {
    const p = await createPartner(db, firmAdmin, { slug: "mine", name: "x", org: "y", type: "other", firmId: "f2" });
    expect(p.firmId).toBe("f1");
  });
});
