/**
 * Referral partner rules, kept pure so the same checks run in the services, the API routes and the tests.
 * Source: research/partner-kit (referral-partner-policy.md, client-disclosure.md) and ABA Model Rules 7.2(b), 5.4, 1.6.
 * This is workflow support for the attorney of record, not legal advice. The attorney sets the limits.
 */
import { z } from "zod";
import { US_STATES } from "@/config/firm";
import { STAGES, type Stage } from "@/server/types";

export const PARTNER_TYPES = ["cpa", "financial_advisor", "funeral_home", "elder_care", "realtor", "other"] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  cpa: "CPA or tax preparer",
  financial_advisor: "Financial advisor",
  funeral_home: "Funeral home",
  elder_care: "Elder care",
  realtor: "Realtor, title or mortgage",
  other: "Other professional",
};

/** Same vocabulary as the status column of partner-tracker-template.csv, plus paused. */
export const PARTNER_STATUSES = ["prospect", "active_sequence", "active", "paused", "do_not_contact"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const RELEASE_STATUSES = ["none", "requested", "granted", "revoked"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export type ValueLinked = "unanswered" | "no" | "yes";

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export const REF_CODE_RE = /^ref-[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

/** Ref codes follow the tracker convention: "ref-" plus the page slug. */
export function refCodeForSlug(slug: string): string {
  return `ref-${slug}`;
}

/** Cleans a ?ref= value from a URL. Returns undefined for anything that is not a plausible code. */
export function normalizeRef(raw: string | null | undefined): string | undefined {
  const v = raw?.trim().toLowerCase();
  return v && REF_CODE_RE.test(v) ? v : undefined;
}

// ---------------------------------------------------------------------------
// Gift gate
// ---------------------------------------------------------------------------

export interface GiftLimits {
  /** Largest single gift, in cents. Conservative internal ceiling from the partner kit: $25. An estimate, not a legal threshold. */
  perGiftCents: number;
  /** Largest total per partner in a calendar year, in cents. Kit suggestion: $50. */
  annualCents: number;
  /** A gift this soon after a referral is flagged: the kit says never give one just after a referral. */
  referralQuietDays: number;
}

export const DEFAULT_GIFT_LIMITS: GiftLimits = { perGiftCents: 2500, annualCents: 5000, referralQuietDays: 14 };

/** Limits the attorney sets: PARTNER_GIFT_LIMIT_USD and PARTNER_GIFT_ANNUAL_LIMIT_USD (whole dollars). */
export function giftLimits(env: Record<string, string | undefined> = process.env): GiftLimits {
  const dollars = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : fallback;
  };
  return {
    perGiftCents: dollars(env.PARTNER_GIFT_LIMIT_USD, DEFAULT_GIFT_LIMITS.perGiftCents),
    annualCents: dollars(env.PARTNER_GIFT_ANNUAL_LIMIT_USD, DEFAULT_GIFT_LIMITS.annualCents),
    referralQuietDays: DEFAULT_GIFT_LIMITS.referralQuietDays,
  };
}

export interface GiftInput {
  valueCents: number;
  /** The person logging says this gift or benefit is connected to a referral (promised, expected, or thanks for one). */
  tiedToReferral: boolean;
  /** Payment, commission, fee share, free work or any other thing of value, as opposed to a token item. */
  thingOfValue: boolean;
  /** Total of this partner's logged gifts earlier in the same calendar year, in cents. */
  ytdCents: number;
  /** Days since this partner's latest referral, or undefined when there is none. */
  daysSinceReferral?: number;
}

export interface GiftVerdict {
  verdict: "allowed" | "flagged" | "blocked";
  /** Plain-language reasons, each naming the rule behind it. Empty when allowed. */
  reasons: string[];
}

export const NO_PAYMENT_RULE =
  "ABA Model Rule 7.2(b): a lawyer may not give or promise anything of value to a person for recommending the lawyer's services. " +
  "Rule 5.4(a) also bars sharing legal fees with a nonlawyer. This firm pays nothing for referrals, in either direction.";

export const NOMINAL_GIFT_RULE =
  "Rule 7.2(b)(5) allows only nominal gifts as an expression of appreciation, never given under any promise or understanding and never intended as payment for referrals.";

/**
 * Blocked: anything of value tied to a referral, and any payment or other thing of value. The gift is not logged as given.
 * Flagged: a nominal gift over the per-gift or annual limit, or one soon after a referral. It is logged and needs the attorney's review.
 */
export function evaluateGift(input: GiftInput, limits: GiftLimits = giftLimits()): GiftVerdict {
  const blocked: string[] = [];
  if (input.tiedToReferral) blocked.push(`Tied to a referral. ${NO_PAYMENT_RULE}`);
  if (input.thingOfValue) blocked.push(`A payment or other thing of value, not a nominal gift. ${NO_PAYMENT_RULE}`);
  if (blocked.length) return { verdict: "blocked", reasons: blocked };

  const flags: string[] = [];
  if (input.valueCents > limits.perGiftCents) {
    flags.push(`Over the per-gift limit of ${usd(limits.perGiftCents)}. ${NOMINAL_GIFT_RULE}`);
  }
  if (input.ytdCents + input.valueCents > limits.annualCents) {
    flags.push(`Brings this partner's total for the year to ${usd(input.ytdCents + input.valueCents)}, over the ${usd(limits.annualCents)} annual limit. ${NOMINAL_GIFT_RULE}`);
  }
  if (input.daysSinceReferral !== undefined && input.daysSinceReferral <= limits.referralQuietDays) {
    flags.push(`Given within ${limits.referralQuietDays} days of a referral. A gift must never follow, or look timed to, a referral. ${NOMINAL_GIFT_RULE}`);
  }
  return flags.length ? { verdict: "flagged", reasons: flags } : { verdict: "allowed", reasons: [] };
}

export function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

// ---------------------------------------------------------------------------
// Release (Rule 1.6) and partner feedback
// ---------------------------------------------------------------------------

const RELEASE_TRANSITIONS: Record<ReleaseStatus, ReleaseStatus[]> = {
  none: ["requested", "granted"],
  requested: ["granted", "revoked", "none"],
  granted: ["revoked"],
  revoked: ["requested", "granted"],
};

export function canMoveRelease(from: ReleaseStatus, to: ReleaseStatus): boolean {
  return RELEASE_TRANSITIONS[from].includes(to);
}

export type FeedbackStatus = "contacted" | "consult_booked" | "engaged";

export const FEEDBACK_LABELS: Record<FeedbackStatus, string> = {
  contacted: "Contacted",
  consult_booked: "Consult booked",
  engaged: "Engaged",
};

/** What the partner is told when there is no release. Nothing about the person, not even whether they got in touch. */
export const NO_RELEASE_MESSAGE = "Thank you for thinking of us.";

const stageIdx = (s: Stage) => STAGES.indexOf(s);

/**
 * The most the partner may learn, reduced to three milestones. Never carries a name, matter type, state, fee,
 * document or any other case fact. Returns undefined before the first milestone.
 */
export function feedbackStatusForStage(stage: Stage): FeedbackStatus | undefined {
  if (stageIdx(stage) >= stageIdx("retainer_signed")) return "engaged";
  if (stageIdx(stage) >= stageIdx("consult_booked")) return "consult_booked";
  if (stageIdx(stage) >= stageIdx("contacted")) return "contacted";
  return undefined;
}

// ---------------------------------------------------------------------------
// Client-facing text (partner-kit/client-disclosure.md blocks A, D and the consent line)
// ---------------------------------------------------------------------------

export const DISCLOSURE_VERSION = "2026-10-06.1";

export function shortDisclosure(partnerName: string, partnerOrg: string, firmName: string): string {
  return (
    `${partnerName} of ${partnerOrg} is a professional ${firmName} refers clients to, and who refers clients to ${firmName}, from time to time. ` +
    "Neither of us pays the other for referrals, the arrangement is not exclusive, and you are free to choose any lawyer or any other professional. " +
    "We recommend only when we believe it serves you."
  );
}

export function referralConsentText(firmName: string): string {
  return (
    `I have asked the person I am referring, and they agree that I may give their name and contact details to ${firmName} ` +
    "so the firm can contact them about estate planning. I will not send any other information about their situation."
  );
}

export const PARTNER_PAGE_FOOTER =
  "works with local professionals who may refer clients to us and whom we may refer clients to. We pay nothing for referrals, the arrangement is not exclusive, and you may use any lawyer. Attorney Advertising. This page is general information, not legal advice.";

// ---------------------------------------------------------------------------
// Partner-submitted referral form
// ---------------------------------------------------------------------------

export const partnerReferralSchema = z.object({
  firstName: z.string("Enter the person's first name").trim().min(1, "Enter the person's first name").max(80),
  lastName: z.string().trim().max(80).default(""),
  email: z.email("Enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^(1?\d{10})?$/, "Enter a 10-digit US phone number"))
    .default(""),
  state: z.enum(US_STATES, "Choose the person's state"),
  /** The partner confirms the person agreed to be referred. The form cannot be sent without it. */
  clientConsent: z.literal(true, { message: "Confirm that the person agreed to be referred" }),
  /** Honeypot. Real visitors never see or fill this field. */
  website: z.string().max(0).optional(),
});

export type PartnerReferralInput = z.infer<typeof partnerReferralSchema>;

export const partnerInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, "Use lowercase letters, numbers and hyphens"),
  name: z.string().trim().min(1).max(120),
  org: z.string().trim().min(1).max(160),
  type: z.enum(PARTNER_TYPES),
  refCode: z.string().trim().toLowerCase().regex(REF_CODE_RE, "Ref codes look like ref-example-cpa").optional(),
  status: z.enum(PARTNER_STATUSES).default("prospect"),
  ownerId: z.string().trim().max(80).optional(),
  firmId: z.string().trim().max(80).optional(),
  policySignedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reciprocalAgreementOnFile: z.boolean().default(false),
  agreementNonexclusive: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional(),
});

export type PartnerInput = z.infer<typeof partnerInputSchema>;
