import type { CaptureTool } from "@/lib/lead";

/**
 * Editable assumptions behind the calculators. These are general figures, not quotes.
 * The attorney must review them (and the state-specific notes) before launch.
 */
export const toolConfig = {
  probate: {
    /** Commonly cited range for total probate costs (court, attorney, executor, appraisal) as a share of the estate. */
    generalCostPercent: { low: 3, high: 7 },
    /** Typical time to close a straightforward probate, in months. */
    generalDurationMonths: { low: 6, high: 18 },
    /** Extra cost range for each additional state where real estate is held (ancillary probate), in dollars. */
    ancillaryPerStateDollars: { low: 2_000, high: 10_000 },
    /** Court filing and publication costs, in dollars, used when no state schedule applies. */
    filingCostsDollars: { low: 500, high: 2_000 },
  },
  /**
   * The firm's flat-fee range for a trust-based plan, in dollars. Leave null to show
   * "ask for a flat-fee quote" instead of a number. Must match what the firm actually charges.
   */
  trustPlanFeeDollars: null as { low: number; high: number } | null,
  /** Same for a will-based plan. */
  willPlanFeeDollars: null as { low: number; high: number } | null,
  /**
   * Capture points where the phone number is optional. Empty means phone is required everywhere.
   * Research suggests gated downloads convert better with phone optional; add "guide" and
   * "exit_offer" here to test that. Intake and callback should always require it.
   */
  phoneOptionalFor: [] as CaptureTool[],
};

/** Federal estate tax basic exclusion per person for 2026 (One Big Beautiful Bill Act). Verify each year. */
export const FEDERAL_ESTATE_TAX_EXEMPTION_2026 = 15_000_000;

/**
 * 2026 state estate tax exemption thresholds, in dollars, from secondary sources.
 * These change every year and must be verified by the attorney before launch.
 */
export const STATE_ESTATE_TAX_THRESHOLDS: Partial<Record<string, number>> = {
  CT: 13_600_000,
  DC: 4_990_000,
  HI: 5_490_000,
  IL: 4_000_000,
  MA: 2_000_000,
  MD: 5_000_000,
  ME: 7_160_000,
  MN: 3_000_000,
  NY: 7_350_000,
  OR: 1_000_000,
  RI: 1_838_000,
  VT: 5_000_000,
  WA: 3_076_000,
};

/** States with an inheritance tax (paid by some heirs, depending on their relationship). */
export const INHERITANCE_TAX_STATES = ["KY", "MD", "NE", "NJ", "PA"];

/**
 * California statutory compensation (Probate Code sections 10800 and 10810). The same
 * schedule applies to the personal representative and, separately, to the attorney.
 * Computed on the gross value of the probate estate. Above $25 million the court sets the fee.
 */
export const CA_STATUTORY_TIERS: { upTo: number; rate: number }[] = [
  { upTo: 100_000, rate: 0.04 },
  { upTo: 200_000, rate: 0.03 },
  { upTo: 1_000_000, rate: 0.02 },
  { upTo: 10_000_000, rate: 0.01 },
  { upTo: 25_000_000, rate: 0.005 },
];
