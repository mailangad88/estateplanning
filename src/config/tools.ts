import { FIGURES, usdMillions } from "@/config/figures";
import type { CaptureTool } from "@/lib/lead";
export interface ToolInfo {
  slug: string;
  title: string;
  description: string;
  answer: string;
}

export const TOOLS: ToolInfo[] = [
  {
    slug: "plan-readiness-assessment",
    title: "Estate plan readiness score",
    description: "Ten quick questions that show how protected your family is today and where the gaps are.",
    answer: "Answer 10 quick questions to get a score out of 100 and a plain-language list of the gaps in your plan.",
  },
  {
    slug: "will-or-trust",
    title: "Will or trust? A quick comparison",
    description: "Answer a few yes-or-no questions about your home, family and privacy to see whether a will or a living trust fits better.",
    answer: "A will is often enough for simpler estates; a living trust usually helps if you own a home, have property in more than one state, or want to avoid probate and keep things private.",
  },
  {
    slug: "estate-tax-estimator",
    title: "Federal estate tax estimator",
    description: "See whether your estate is near the federal estate tax exemption and roughly what tax could be owed.",
    answer: `Most estates owe no federal estate tax because the ${FIGURES.year} exemption is ${usdMillions(FIGURES.federalExemption)} per person. This estimator shows how close yours is.`,
  },
  {
    slug: "probate-cost-estimator",
    title: "Probate cost estimator",
    description: "Estimate what probate could cost your family, using fee assumptions you can adjust for your state.",
    answer: "Probate costs come from court fees, attorney and executor fees, appraisals and time. Adjust the assumptions to match your state.",
  },
  {
    slug: "life-insurance-needs",
    title: "Life insurance needs calculator",
    description: "Estimate how much life insurance would replace your income, pay off debts and cover your children's costs.",
    answer: "A common way to size coverage adds debts, years of income, the mortgage and education costs, then subtracts savings and existing coverage.",
  },
  {
    slug: "guardian-fund-calculator",
    title: "Guardian funding calculator",
    description: "Estimate how much a guardian would need to raise your children to adulthood.",
    answer: "Multiply each child's yearly cost by the years until they are independent, then add education. That is the gap your plan funds.",
  },
  {
    slug: "medicaid-lookback-date",
    title: "Medicaid look-back date finder",
    description: "Find the start of the 60-month Medicaid look-back window for a given application date.",
    answer: "For nursing home Medicaid, most states review gifts and transfers made in the 60 months before the application date.",
  },
  {
    slug: "executor-workload",
    title: "Executor task planner",
    description: "Build a personal task list for settling an estate, based on what the person owned.",
    answer: "An executor's work depends on what the person owned. This planner builds the task list for your situation.",
  },
  {
    slug: "plan-review-reminder",
    title: "Is it time to update my plan?",
    description: "Check whether your existing will or trust is due for a review, and set a free yearly reminder.",
    answer: "Plans are commonly reviewed every 3 to 5 years and after any major life change such as a birth, marriage, divorce, move or death.",
  },
  {
    slug: "state-death-tax-checker",
    title: "Estate and inheritance tax checker by state",
    description: "Check federal estate tax, your state's estate tax and any inheritance tax your heirs could owe, with as-of dates and sources.",
    answer: "Only about a dozen states plus DC have an estate tax, and five (Kentucky, Maryland, Nebraska, New Jersey and Pennsylvania) have an inheritance tax. Federal estate tax starts above the per-person exemption, so most families owe none.",
  },
  {
    slug: "small-estate-checker",
    title: "Small estate checker: can the family skip full probate?",
    description: "See whether a loved one's estate may qualify for a small estate affidavit or a simplified court process in their state.",
    answer: "Many states let a small estate skip full probate, but the limits, waiting periods and real estate rules differ widely. For example, California's affidavit limit is $208,850 for deaths since April 2025, and real estate generally needs a separate route.",
  },
  {
    slug: "medicaid-savings-runway",
    title: "How long will our savings last in a nursing home?",
    description: "Estimate how many months savings could cover care before reaching your state's Medicaid asset limit, with the spouse-at-home protection for married couples.",
    answer: "Divide what you can spend down by the monthly gap between care costs and income. A shortfall of $6,500 a month uses up $150,000 in roughly two years. What can be protected legally is a question for an elder law attorney, because gifts in the five-year look-back can cause penalties.",
  },
  {
    slug: "beneficiary-audit",
    title: "Beneficiary audit",
    description: "List your accounts and who is named on each, as categories only, and get a flagged list of gaps to fix.",
    answer: "A beneficiary form usually overrides your will, so an ex-spouse, a minor child or a blank form can send money where you don't intend. Check each form after any life change.",
  },
  {
    slug: "guardian-picker",
    title: "Guardian picker: compare who could raise your children",
    description: "Compare up to three possible guardians on the priorities you choose, with notes on backups, money and the conversation to have.",
    answer: "Rate each person against what matters most to you. The best fit is a starting point for a conversation, not a verdict. Many parents also name a backup, and a court makes the final decision, so put your choice in a signed will.",
  },

];
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
export const FEDERAL_ESTATE_TAX_EXEMPTION_2026 = FIGURES.federalExemption;

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

/**
 * The calculator or decision tool that best fits an article, matched on words in its path.
 * First match wins, so the more specific patterns come first.
 */
const TOOL_BY_PATH: [RegExp, string][] = [
  [/small-estate|skip-probate|bank-account-after-death/, "small-estate-checker"],
  [/inheritance-tax|estate-tax|death-tax/, "state-death-tax-checker"],
  [/medicaid|long-term-care|nursing-home|aging-parent/, "medicaid-savings-runway"],
  [/beneficiar|retirement-accounts|payable-on-death/, "beneficiary-audit"],
  [/guardian|new-baby|minor/, "guardian-picker"],
  [/probate/, "probate-cost-estimator"],
  [/will-vs-trust|living-trust|revocable/, "will-or-trust"],
  [/life-insurance/, "life-insurance-needs"],
];

export function toolFor(path: string): ToolInfo | undefined {
  const hit = TOOL_BY_PATH.find(([re]) => re.test(path));
  return hit ? TOOLS.find((t) => t.slug === hit[1]) : undefined;
}
