import type { BusinessStructure } from "@/lib/fees";

/**
 * Firm profile for the launch. Values marked PLACEHOLDER must be replaced
 * once the launch state and firm details are confirmed.
 */
export const firm = {
  brandName: "Family Plan Law", // PLACEHOLDER brand name
  firmLegalName: "[Firm legal name]", // PLACEHOLDER
  attorneyName: "[Attorney name]", // PLACEHOLDER
  barNumber: "[Bar number]", // PLACEHOLDER
  phone: "(000) 000-0000", // PLACEHOLDER tracked number
  officeAddress: "[Office address]", // PLACEHOLDER, required for attorney advertising and CAN-SPAM
  /**
   * Structure the platform operates under. "in_firm" (Model A in the plan) means
   * the platform is the firm's own marketing and intake department.
   * Changing this changes which fee types the fee engine will allow.
   */
  structure: "in_firm" as BusinessStructure,
};

/** States the firm is licensed in and accepts leads from. "XX" is the placeholder. */
export function servedStates(): string[] {
  const raw = process.env.SERVED_STATES ?? "XX";
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
