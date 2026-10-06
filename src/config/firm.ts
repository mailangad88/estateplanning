import type { BusinessStructure } from "@/lib/fees";

/**
 * Single source of firm facts, read by every page, footer, schema block and email.
 * Values in [brackets] or marked PLACEHOLDER are unfilled; `npm run launch-check`
 * blocks production deploys until they are replaced.
 */
export const firm = {
  brandName: "Family Plan Law", // PLACEHOLDER brand name
  firmLegalName: "[Firm legal name]",
  attorneyName: "[Attorney name]",
  attorneyTitle: "Estate planning attorney",
  barNumber: "[Bar number]",
  phone: "(000) 000-0000", // PLACEHOLDER tracked number
  officeAddress: "[Office address]",
  /** City or county and state of a real (bona fide) office. California and Florida require it on every ad. */
  officeLocality: "[Office city or county, state]",
  officeHours: "[Office hours]",
  /** What the site promises about response time. Keep it true. */
  responseTime: "[Response time, e.g. within one business day]",
  /** State of licensure. Pages say "your state" until this is filled. */
  licensedState: "[Firm licensed state]",
  /** Bio and process facts only the attorney can supply. Pages show them as visible placeholders. */
  yearsInPractice: "[Attorney: year admitted to practice]",
  lawSchool: "[Attorney: law school and year]",
  consultLength: "[Attorney: consult length in minutes]",
  consultFormat: "[Attorney: phone, video or in person]",
  consultFee: "[Attorney: consult fee, or no fee]",
  draftingTime: "[Attorney: typical drafting time]",
  /** Profile URLs (state bar, Google Business Profile and similar) that identify the firm. Empty omits sameAs from structured data. */
  sameAs: [] as string[],
  /** Profile URLs for the attorney. Empty omits sameAs from structured data. */
  attorneySameAs: [] as string[],
  barLookupUrl: null as string | null, // state bar lawyer-lookup URL, set when known
  /** Attorney headshot under public/, e.g. "/media/attorney.jpg". Null shows no photo and omits image from schema. */
  attorneyHeadshot: null as string | null,
  /** Two or three plain sentences in the attorney's own words, shown on the profile and in Person schema. */
  attorneyShortBio: "[Attorney: two or three sentence bio in your own words]",
  /**
   * Booking page embedded after a consult request (Calendly, Cal.com, Lawmatics or Clio Grow).
   * Must be an https URL the scheduler allows in an iframe. Null keeps the "our team will reach out"
   * message and loads nothing from a third party.
   */
  schedulerUrl: null as string | null,
  /**
   * Cal.com booking link as "username/event-slug". When valid it replaces the iframe with the hosted
   * Cal.com inline embed, which reports bookings back to the site. Null or malformed falls back to schedulerUrl.
   */
  calcomLink: (/^[a-z0-9_-]+\/[a-z0-9_-]+$/i.test(process.env.NEXT_PUBLIC_CALCOM_LINK ?? "")
    ? process.env.NEXT_PUBLIC_CALCOM_LINK!
    : null) as string | null,
  /** Number visitors can text. Must be registered for business texting (10DLC) before launch. Null hides the Text button. */
  textNumber: "(000) 000-0000" as string | null, // PLACEHOLDER
  /**
   * Structure the platform operates under. "in_firm" (Model A in the plan) means
   * the platform is the firm's own marketing and intake department.
   * Changing this changes which fee types the fee engine will allow.
   */
  structure: "in_firm" as BusinessStructure,
  /**
   * Attorney bio facts used on /about and /legal/attorney-advertising. Every value must come
   * from the attorney and be checkable (bar profile, diploma). Never fill these from guesses.
   */
  attorneyBio: {
    licensedIn: "[Attorney bar admissions: state and year for each]",
    education: "[Attorney law school and year]",
    practiceFocus: "Practice focused on estate planning",
    /** Only a certification the attorney actually holds, with the certifying body and area named. Null hides it. */
    certification: null as string | null,
    /** Awards only from bodies that do not sell them, with issuer and year. Empty hides the list. */
    awards: [] as string[],
  },
  /**
   * Dynamic number insertion. Keys: "source/medium" (exact), "source" (any medium), or "*" + "/medium" (any source).
   * The first-touch source of the visit picks the number; anything unmatched shows `phone`.
   * Each number must be a real call-tracking line forwarding to the office before launch.
   */
  trackingNumbers: {
    "google/cpc": "(000) 000-0000", // PLACEHOLDER Google Ads
    "bing/cpc": "(000) 000-0000", // PLACEHOLDER Microsoft Ads
    "facebook/paid_social": "(000) 000-0000", // PLACEHOLDER Meta ads
    "gbp": "(000) 000-0000", // PLACEHOLDER Google Business Profile (utm_source=gbp)
    "*/email": "(000) 000-0000", // PLACEHOLDER newsletters and nurture email
  } as Record<string, string>,
};

export interface Package {
  /** Stable id used on engagements: essentials (good), complete (better), legacy (best) */
  id: "essentials" | "complete" | "legacy";
  name: string;
  price: string;
  for: string;
  includes: string[];
  /** Standing exclusions printed on the engagement letter for this package */
  excludes: string[];
}

/** Flat-fee packages shown on /pricing. Prices are set by the firm. */
export const packages: Package[] = [
  { id: "essentials", name: "Essentials", price: "[Flat fee]", for: "One person or a couple with modest assets and no minor children.", includes: ["Will (each spouse)", "Guardian nominations if you have children", "Durable financial power of attorney", "Healthcare power of attorney, living will and HIPAA release", "Signing ceremony"], excludes: ["Trust drafting", "Real estate deeds", "Tax planning", "Court proceedings"] },
  { id: "complete", name: "Complete", price: "[Flat fee]", for: "Homeowners and families with minor children. The usual fit for families with a home, not the right fit for everyone.", includes: ["Revocable living trust", "Pour-over will", "Financial and healthcare powers of attorney", "Living will and HIPAA release", "Deed transfer of your home into the trust", "Funding checklist plus one review", "Signing ceremony"], excludes: ["Tax planning beyond the trust", "Deeds not listed in the custom scope", "Court proceedings"] },
  { id: "legacy", name: "Legacy", price: "Quote after consult", for: "Blended families, business owners, property in more than one state, special needs planning or larger estates.", includes: ["Everything in Complete", "Special needs or children's trust provisions", "Additional deeds", "Business interest assignment", "Coordination with your financial advisor or CPA"], excludes: ["Court proceedings", "Tax return preparation", "Work outside the custom scope"] },
];

/** States the firm is licensed in and accepts leads from. "XX" is the placeholder. */
export function servedStates(): string[] {
  const raw = process.env.SERVED_STATES ?? process.env.NEXT_PUBLIC_SERVED_STATES ?? "XX";
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
  "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

/** Optional extras the attorney can add to a package. The attorney sets each price on the engagement. */
export const addOns = [
  { id: "annual_review", name: "Annual review plan", description: "A yearly check that the plan still matches your family and assets." },
  { id: "extra_parcel", name: "Additional real estate parcel", description: "Deed transfer of one more property into the trust." },
  { id: "document_storage", name: "Original document safekeeping", description: "The firm keeps your signed originals in safekeeping." },
  { id: "pet_trust", name: "Pet trust", description: "Funds and instructions for the care of a pet." },
  { id: "digital_assets", name: "Digital asset provisions", description: "Access to online accounts and digital property." },
  { id: "notary_witness", name: "Notary and witness package", description: "The firm supplies the notary and witnesses at the signing." },
] as const;

/**
 * How retainer payments are received and split over time. The attorney sets these.
 *
 * `account` defaults to "trust" on purpose. Whether a flat fee paid in advance is earned on receipt
 * (operating account) or must sit in the client trust account until earned differs by state and
 * is governed by Rules 1.5 and 1.15 and the engagement letter wording. Trust is the safe default:
 * putting unearned money in operating is a violation, while holding earned money in trust only
 * needs a later transfer. Switch to "operating" only after confirming your state allows it and the
 * letter says so. Every payment records the account it was directed to.
 *
 * Plans never carry interest or a financing charge: the installments add up to exactly the fee.
 */
export const retainerPayments = {
  account: "trust" as "trust" | "operating",
  plan: {
    enabled: true,
    maxInstallments: 6,
    /** Minimum deposit as a percent of the total fee */
    minDepositPercent: 25,
    /** Smallest installment, in cents */
    minInstallmentCents: 10_000,
    /** Fees below this are paid in full */
    minTotalCents: 50_000,
    /** Days after the due date before an unpaid installment is flagged late */
    lateGraceDays: 3,
  },
};
