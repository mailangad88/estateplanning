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
  officeHours: "[Office hours]",
  /** What the site promises about response time. Keep it true. */
  responseTime: "[Response time, e.g. within one business day]",
  /** Number visitors can text. Must be registered for business texting (10DLC) before launch. Null hides the Text button. */
  textNumber: "(000) 000-0000" as string | null, // PLACEHOLDER
  /**
   * Structure the platform operates under. "in_firm" (Model A in the plan) means
   * the platform is the firm's own marketing and intake department.
   * Changing this changes which fee types the fee engine will allow.
   */
  structure: "in_firm" as BusinessStructure,
};

export interface Package {
  name: string;
  price: string;
  for: string;
  includes: string[];
}

/** Flat-fee packages shown on /pricing. Prices are set by the firm. */
export const packages: Package[] = [
  { name: "Will package", price: "[Flat fee]", for: "Single people or couples with simpler estates who are comfortable with probate.", includes: ["Will (each spouse)", "Guardian nominations for minor children", "Financial power of attorney", "Healthcare power of attorney and living will", "HIPAA release", "Signing ceremony"] },
  { name: "Trust package", price: "[Flat fee]", for: "Homeowners and families who want to avoid probate and keep things private.", includes: ["Revocable living trust", "Pour-over will", "Financial and healthcare powers of attorney", "Living will and HIPAA release", "Deed transfer of your home into the trust", "Funding instructions and checklist", "Signing ceremony"] },
  { name: "Trust plus", price: "[Flat fee]", for: "Blended families, special-needs planning, business owners or property in more than one state.", includes: ["Everything in the trust package", "Special needs or children's trust provisions", "Additional deeds", "Business interest assignment", "Coordination with your financial advisor or CPA"] },
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
