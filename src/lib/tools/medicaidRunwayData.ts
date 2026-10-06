// Medicaid long-term care facts for the savings runway calculator.
// Copied from research/medicaid-ltc-data-by-state.json (generated 2026-10-06).
// Rule R4: a value is shown as a number only when confidence is "high" or "medium"
// and asOf is within 12 months. Anything else is stored as null or "unverified".

export type Confidence = "high" | "medium" | "unverified";

export interface Fact<T> {
  value: T | null;
  asOf: string; // ISO date
  confidence: Confidence;
  source: string; // URL
}

export interface StateMedicaid {
  /** Countable asset limit for a single applicant, in dollars. */
  assetLimit: Fact<number>;
  /** How the state sets the community spouse protected amount. */
  csraRule: Fact<"half" | "maximum">;
  lookbackMonths: Fact<number>;
  homeEquityLimit: Fact<number>;
  /** Median private nursing home room, per month (2025 CareScout survey). */
  nursingHomeMonthly: Fact<number>;
}

export const FEDERAL = {
  csraMin: { value: 32532, asOf: "2026-01-01", confidence: "high", source: "https://www.medicaid.gov/federal-policy-guidance/downloads/cib12092025.pdf" },
  csraMax: { value: 162660, asOf: "2026-01-01", confidence: "high", source: "https://www.medicaid.gov/federal-policy-guidance/downloads/cib12092025.pdf" },
  mmmnaMin: { value: 2643.75, asOf: "2026-01-01", confidence: "high", source: "https://www.medicaid.gov/federal-policy-guidance/downloads/cib12092025.pdf" },
  mmmnaMax: { value: 4066.5, asOf: "2026-01-01", confidence: "high", source: "https://www.medicaid.gov/federal-policy-guidance/downloads/cib12092025.pdf" },
  homeEquityMin: { value: 752000, asOf: "2026-01-01", confidence: "high", source: "https://www.medicaid.gov/federal-policy-guidance/downloads/cib12092025.pdf" },
  homeEquityMax: { value: 1130000, asOf: "2026-01-01", confidence: "high", source: "https://www.medicaid.gov/federal-policy-guidance/downloads/cib12092025.pdf" },
} as const satisfies Record<string, Fact<number>>;

export const MEDICAID_STATES: Record<string, StateMedicaid> = {
  CA: {
    assetLimit: { value: 130000, asOf: "2026-01-01", confidence: "high", source: "https://www.dhcs.ca.gov/services/medi-cal/eligibility/letters/Documents/25-18.pdf" },
    csraRule: { value: null, asOf: "2026-03-20", confidence: "unverified", source: "https://healthconsumer.org/wp/wp-content/uploads/2026/03/Asset-Limits-Practice-Tip-12-2025-March-2026-Update.pdf" },
    lookbackMonths: { value: 30, asOf: "2025-10-09", confidence: "high", source: "https://www.dhcs.ca.gov/services/medi-cal/eligibility/letters/Documents/25-18.pdf" },
    homeEquityLimit: { value: null, asOf: "2025-08-20", confidence: "unverified", source: "https://healthlaw.org/wp-content/uploads/2025/09/2025.08.20-Medi-Cal-Fact-Sheet-Home-Equity-and-Asset-Limits-FINAL.pdf" },
    nursingHomeMonthly: { value: 15178, asOf: "2025-11-30", confidence: "high", source: "https://assets.carescout.com/x/fe3fe51756/298701.pdf" },
  },
  TX: {
    assetLimit: { value: 2000, asOf: "2026-03-04", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-texas/" },
    csraRule: { value: "half", asOf: "2026-03-04", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-texas/" },
    lookbackMonths: { value: 60, asOf: "2026-03-04", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-texas/" },
    homeEquityLimit: { value: 752000, asOf: "2026-03-04", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-texas/" },
    nursingHomeMonthly: { value: 7604, asOf: "2025-11-30", confidence: "high", source: "https://assets.carescout.com/x/fe3fe51756/298701.pdf" },
  },
  FL: {
    assetLimit: { value: 2000, asOf: "2026-06-04", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-florida/" },
    csraRule: { value: "half", asOf: "2026-06-04", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-florida/" },
    lookbackMonths: { value: 60, asOf: "2026-06-04", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-florida/" },
    homeEquityLimit: { value: 752000, asOf: "2026-06-04", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-florida/" },
    nursingHomeMonthly: { value: 12167, asOf: "2025-11-30", confidence: "high", source: "https://assets.carescout.com/x/fe3fe51756/298701.pdf" },
  },
  NY: {
    assetLimit: { value: 33038, asOf: "2026-01-01", confidence: "medium", source: "https://frblaw.com/important-elder-law-update-new-york-state-medicaid-resource-income-allowance-levels-for-2026/" },
    csraRule: { value: null, asOf: "2026-01-01", confidence: "unverified", source: "https://healthweb-back.health.ny.gov/health_care/medicaid/publications/docs/gis/26ma03_att1.pdf" },
    lookbackMonths: { value: 60, asOf: "2026-03-04", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-new-york/" },
    homeEquityLimit: { value: 1130000, asOf: "2026-01-01", confidence: "high", source: "https://frblaw.com/important-elder-law-update-new-york-state-medicaid-resource-income-allowance-levels-for-2026/" },
    nursingHomeMonthly: { value: 16729, asOf: "2025-11-30", confidence: "high", source: "https://assets.carescout.com/x/fe3fe51756/298701.pdf" },
  },
  PA: {
    assetLimit: { value: null, asOf: "2025-01-01", confidence: "unverified", source: "https://www.begleylawgroup.com/?p=11446" },
    csraRule: { value: "half", asOf: "2026-06-05", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-pennsylvania/" },
    lookbackMonths: { value: 60, asOf: "2026-06-05", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-pennsylvania/" },
    homeEquityLimit: { value: 752000, asOf: "2026-06-05", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-pennsylvania/" },
    nursingHomeMonthly: { value: 13688, asOf: "2025-11-30", confidence: "high", source: "https://assets.carescout.com/x/fe3fe51756/298701.pdf" },
  },
  IL: {
    assetLimit: { value: 17500, asOf: "2026-01-01", confidence: "high", source: "https://ilaging.illinois.gov/content/dam/soi/en/web/aging/ship/documents/medicaidincomeassetlimits.pdf" },
    csraRule: { value: null, asOf: "2026-01-01", confidence: "unverified", source: "https://ilaging.illinois.gov/content/dam/soi/en/web/aging/ship/documents/spousal-impoverishment-standards.pdf" },
    lookbackMonths: { value: 60, asOf: "2012-01-01", confidence: "high", source: "https://hfs.illinois.gov/medicalproviders/ltss/ltc/highlightsltc.html" },
    homeEquityLimit: { value: 752000, asOf: "2026-01-01", confidence: "high", source: "https://ilaging.illinois.gov/content/dam/soi/en/web/aging/ship/documents/spousal-impoverishment-standards.pdf" },
    nursingHomeMonthly: { value: 9216, asOf: "2025-11-30", confidence: "high", source: "https://assets.carescout.com/x/fe3fe51756/298701.pdf" },
  },
  OH: {
    assetLimit: { value: 2000, asOf: "2026-06-05", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-ohio/" },
    csraRule: { value: "half", asOf: "2026-06-05", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-ohio/" },
    lookbackMonths: { value: 60, asOf: "2026-01-01", confidence: "high", source: "https://codes.ohio.gov/ohio-administrative-code/chapter-5160:1-6" },
    homeEquityLimit: { value: 752000, asOf: "2026-06-05", confidence: "unverified", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-ohio/" },
    nursingHomeMonthly: { value: 10389, asOf: "2025-11-30", confidence: "high", source: "https://assets.carescout.com/x/fe3fe51756/298701.pdf" },
  },
  GA: {
    assetLimit: { value: 2000, asOf: "2026-03-04", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-georgia/" },
    csraRule: { value: null, asOf: "2026-03-04", confidence: "unverified", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-georgia/" },
    lookbackMonths: { value: 60, asOf: "2026-03-04", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-georgia/" },
    homeEquityLimit: { value: 752000, asOf: "2026-03-04", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-georgia/" },
    nursingHomeMonthly: { value: 9429, asOf: "2025-11-30", confidence: "high", source: "https://assets.carescout.com/x/fe3fe51756/298701.pdf" },
  },
  NC: {
    assetLimit: { value: 2000, asOf: "2026-06-05", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-north-carolina/" },
    csraRule: { value: "half", asOf: "2026-06-05", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-north-carolina/" },
    lookbackMonths: { value: 60, asOf: "2026-06-05", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-north-carolina/" },
    homeEquityLimit: { value: 752000, asOf: "2026-06-05", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-north-carolina/" },
    nursingHomeMonthly: { value: 10798, asOf: "2025-11-30", confidence: "high", source: "https://assets.carescout.com/x/fe3fe51756/298701.pdf" },
  },
  MI: {
    assetLimit: { value: 9950, asOf: "2026-06-12", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-michigan/" },
    csraRule: { value: "half", asOf: "2026-06-12", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-michigan/" },
    lookbackMonths: { value: 60, asOf: "2026-06-12", confidence: "high", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-michigan/" },
    homeEquityLimit: { value: 752000, asOf: "2026-06-12", confidence: "medium", source: "https://www.medicaidplanningassistance.org/medicaid-eligibility-michigan/" },
    nursingHomeMonthly: { value: 11969, asOf: "2025-11-30", confidence: "high", source: "https://assets.carescout.com/x/fe3fe51756/298701.pdf" },
  },
};
