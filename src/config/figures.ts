/**
 * Single source for annual federal figures. Code reads them from here; tools.ts re-exports.
 * Each figure carries the year it applies to and where it comes from. Re-check every January.
 * VERIFY before launch: these come from public federal sources as of 2026.
 */
export interface Figure<T> {
  value: T;
  /** Tax year or date the value was last confirmed for. */
  asOf: string;
  source: string;
}

export const FIGURES = {
  year: 2026,
  /** Federal estate tax basic exclusion per person, 2026 (One Big Beautiful Bill Act, indexed after 2026). */
  federalExemption: 15_000_000,
  /** Top federal estate tax rate. */
  federalTopRate: 0.4,
  /** Annual gift tax exclusion per recipient (2025 figure; update when the 2026 figure is confirmed). */
  annualGiftExclusion: 19_000,
  /** Medicaid look-back period for nursing home coverage, in months (most states). */
  medicaidLookbackMonths: 60,
  /** Years after the date of death to elect portability under the simplified method (Rev. Proc. 2022-32). */
  portabilityDeadlineYears: 5,
  /** ABLE account annual contribution limit; it equals the annual gift exclusion. */
  ableAnnualContributionLimit: 19_000,
};

/** The same figures with an as-of date and source, for pages that cite them. */
export const FIGURE_DETAILS: Record<string, Figure<number>> = {
  federalExemption: { value: FIGURES.federalExemption, asOf: "2026", source: "One Big Beautiful Bill Act; IRS estate tax page" },
  annualGiftExclusion: { value: FIGURES.annualGiftExclusion, asOf: "2025", source: "IRS gift tax FAQ" },
  medicaidLookbackMonths: { value: FIGURES.medicaidLookbackMonths, asOf: "2026", source: "Deficit Reduction Act of 2005; California differs" },
  portabilityDeadlineYears: { value: FIGURES.portabilityDeadlineYears, asOf: "2026", source: "IRS Rev. Proc. 2022-32" },
  ableAnnualContributionLimit: { value: FIGURES.ableAnnualContributionLimit, asOf: "2025", source: "IRC section 529A, tied to the gift exclusion" },
};

/** Whole dollars with commas, such as $15,000,000. */
export function usdFigure(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/** Millions as words, such as "$15 million". */
export function usdMillions(n: number): string {
  return `$${n / 1_000_000} million`;
}
