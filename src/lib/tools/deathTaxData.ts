import { STATE_ESTATE_TAX_THRESHOLDS, INHERITANCE_TAX_STATES } from "@/config/tools";
import { US_STATES } from "@/config/firm";

export type Confidence = "high" | "medium" | "unverified";

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export const FEDERAL_SOURCE = "https://www.irs.gov/businesses/small-businesses-self-employed/estate-tax";
export const STATE_TABLE_SOURCE = "https://taxfoundation.org/data/all/state/estate-inheritance-taxes/";

export interface EstateTaxMeta {
  /** Top marginal rate, a ceiling on the part above the exemption (percent). */
  topRatePct: number;
  /** Whether a surviving spouse can carry over an unused exemption. null means not verified. */
  portable: boolean | null;
  /** When set, the exemption is lost once the estate passes this share of it (New York). */
  cliffPct?: number;
  note?: string;
  asOf: string;
  confidence: Confidence;
  source: string;
  cite: string;
}

export interface InheritanceClass {
  heir: "spouse" | "children" | "siblings" | "others";
  /** Rate as a fraction. null means the class table is not verified, so no number is shown. */
  rate: number | null;
  label: string;
}

export interface InheritanceTaxMeta {
  classes: InheritanceClass[];
  /** True only when every class rate has been verified, which allows a dollar computation. */
  computable: boolean;
  note: string;
  asOf: string;
  confidence: Confidence;
  source: string;
  cite: string;
}

const T = (
  topRatePct: number,
  portable: boolean | null,
  cite: string,
  extra: Partial<EstateTaxMeta> = {},
): EstateTaxMeta => ({
  topRatePct,
  portable,
  asOf: "2025",
  confidence: "medium",
  source: STATE_TABLE_SOURCE,
  cite,
  ...extra,
});

/** Per-state estate tax metadata. Exemption amounts come from STATE_ESTATE_TAX_THRESHOLDS. */
export const ESTATE_TAX_META: Record<string, EstateTaxMeta> = {
  CT: T(12, null, "Conn. Gen. Stat. ch. 217"),
  DC: T(16, null, "D.C. Code 47-3701 et seq."),
  HI: T(20, null, "Haw. Rev. Stat. ch. 236E"),
  IL: T(16, false, "35 ILCS 405", {
    asOf: "2026",
    confidence: "high",
    note: "Above the exemption the tax is figured with an interrelated formula, so the effective rate can climb quickly just over the line.",
  }),
  MA: T(16, false, "M.G.L. c. 65C"),
  MD: T(16, null, "Md. Code, Tax-General 7-301 et seq."),
  ME: T(12, null, "36 M.R.S. ch. 575"),
  MN: T(16, false, "Minn. Stat. ch. 291"),
  NY: T(16, false, "N.Y. Tax Law 952", {
    asOf: "2026",
    confidence: "high",
    cliffPct: 105,
    note: "New York phases the exclusion out between 100% and 105% of the exclusion amount and loses it above that, so tax is figured on the whole estate.",
  }),
  OR: T(16, false, "ORS ch. 118"),
  RI: T(16, null, "R.I. Gen. Laws ch. 44-22"),
  VT: T(16, null, "32 V.S.A. ch. 190"),
  WA: T(35, false, "RCW ch. 83.100"),
};

const UNVERIFIED_NOTE =
  "Spouses and many close relatives are commonly exempt, and rates and exemptions depend on the relationship to the person who died. An attorney can confirm the class for your family.";

const U = (cite: string, source: string): InheritanceTaxMeta => ({
  classes: [
    { heir: "spouse", rate: null, label: "Spouses are commonly exempt" },
    { heir: "children", rate: null, label: "Children and other close relatives: depends on the class" },
    { heir: "siblings", rate: null, label: "Siblings: depends on the class" },
    { heir: "others", rate: null, label: "Others: usually the highest rates" },
  ],
  computable: false,
  note: UNVERIFIED_NOTE,
  asOf: "2025",
  confidence: "unverified",
  source,
  cite,
});

export const INHERITANCE_TAX_META: Record<string, InheritanceTaxMeta> = {
  KY: U("KRS ch. 140", "https://revenue.ky.gov/"),
  MD: U("Md. Code, Tax-General 7-201 et seq.", "https://www.marylandcomptroller.gov/"),
  NE: U("Neb. Rev. Stat. 77-2001 et seq.", "https://revenue.nebraska.gov/"),
  NJ: U("N.J.S.A. 54:34-1 et seq.", "https://www.nj.gov/treasury/taxation/"),
  PA: {
    classes: [
      { heir: "spouse", rate: 0, label: "Spouse: 0%" },
      { heir: "children", rate: 0.045, label: "Children, grandchildren and other lineal descendants: 4.5%" },
      { heir: "siblings", rate: 0.12, label: "Siblings: 12%" },
      { heir: "others", rate: 0.15, label: "Everyone else: 15%" },
    ],
    computable: true,
    note: "A 5% discount commonly applies if the tax is paid within 3 months of death. The return and payment are due 9 months after death. Joint property with a non-spouse can be taxable.",
    asOf: "2026",
    confidence: "high",
    source: "https://www.pa.gov/agencies/revenue",
    cite: "72 P.S. 9116",
  },
};

export const PA_EARLY_PAYMENT_DISCOUNT = 0.05;

/** All 50 states plus DC for the state select. */
export const ALL_STATE_CODES: readonly string[] = US_STATES;

// Keep the metadata and the shared config in step.
export function dataIsConsistent(): string[] {
  const problems: string[] = [];
  for (const code of Object.keys(STATE_ESTATE_TAX_THRESHOLDS)) {
    if (!ESTATE_TAX_META[code]) problems.push(`missing estate tax meta for ${code}`);
  }
  for (const code of Object.keys(ESTATE_TAX_META)) {
    if (STATE_ESTATE_TAX_THRESHOLDS[code] === undefined) problems.push(`no threshold for ${code}`);
  }
  for (const code of INHERITANCE_TAX_STATES) {
    if (!INHERITANCE_TAX_META[code]) problems.push(`missing inheritance meta for ${code}`);
  }
  return problems;
}
