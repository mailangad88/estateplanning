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
    description: "Twelve yes-or-no questions that show how protected your family is today and where the gaps are.",
    answer: "Answer 12 quick questions to get a score out of 100 and the three gaps that matter most for your family.",
  },
  {
    slug: "estate-tax-estimator",
    title: "Federal estate tax estimator",
    description: "See whether your estate is near the federal estate tax exemption and roughly what tax could be owed.",
    answer: "Most estates owe no federal estate tax because the 2026 exemption is $15 million per person. This estimator shows how close yours is.",
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
];
