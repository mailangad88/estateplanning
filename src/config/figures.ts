/**
 * Federal figures used by the calculators. Each must be checked every January.
 * VERIFY before launch: these come from public federal sources as of 2026.
 */
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
};
