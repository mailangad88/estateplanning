/**
 * Small estate affidavit eligibility checker. Pure logic and rule data, no React.
 * Educational only: eligibility is decided by the court or the institution holding the asset.
 * Seeded from research/state-data-layer.json (small_estate_threshold) and tool-specs.md section 6.
 */

export type RuleConfidence = "high" | "medium" | "unverified";
export type Route = "affidavit_private" | "court_simplified" | "none";

export interface SmallEstateRule {
  state: string;
  route: Route;
  routeName: string;
  /** null = no dollar cap */
  capUsd: number | null;
  /** Dated tiers, latest first. `from` is the first date of death the tier applies to. */
  capByDeathDate?: { from: string; capUsd: number }[];
  /** Deaths before this date are outside the data we hold. */
  earliestDeathCovered?: string;
  capCountsRealProperty: boolean;
  realPropertyAllowed: "no" | "separate_route" | "yes";
  realPropertyNote?: string;
  excludedFromCap: string[];
  intestateOnly: boolean;
  waitDays: number | null;
  courtApprovalRequired: boolean;
  spouseRule?: { capUsd: number; label: string };
  /** Only for the death date check: IL vehicles are left out of the count. */
  vehiclesExcluded?: boolean;
  /** Florida: any value once the death was more than this many years ago. */
  noCapAfterYears?: number;
  /** Michigan: the indexed cap is only in the data for these death years. */
  onlyDeathYears?: number[];
  statuteCite: string;
  source: string;
  asOf: string;
  confidence: RuleConfidence;
}

const AS_OF = "2026-10-06";

export const SMALL_ESTATE_RULES: Record<string, SmallEstateRule> = {
  CA: {
    state: "CA",
    route: "affidavit_private",
    routeName: "small estate affidavit",
    capUsd: 208_850,
    capByDeathDate: [
      { from: "2025-04-01", capUsd: 208_850 },
      { from: "2022-04-01", capUsd: 184_500 },
    ],
    earliestDeathCovered: "2022-04-01",
    capCountsRealProperty: true,
    realPropertyAllowed: "separate_route",
    realPropertyNote: "California has separate court petitions for a home and for property passing to a spouse. An attorney can check which one fits.",
    excludedFromCap: ["Property that passes by beneficiary designation, joint ownership or a trust"],
    intestateOnly: false,
    waitDays: 40,
    courtApprovalRequired: false,
    statuteCite: "Cal. Prob. Code 13100",
    source: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PROB&sectionNum=13100",
    asOf: AS_OF,
    confidence: "high",
  },
  TX: {
    state: "TX",
    route: "court_simplified",
    routeName: "small estate affidavit (judge approves)",
    capUsd: 75_000,
    capCountsRealProperty: false,
    realPropertyAllowed: "no",
    realPropertyNote: "In Texas, real estate does not pass by this affidavit. If there is a will, a muniment of title is a common court route for the property.",
    excludedFromCap: ["Homestead", "Property exempt from creditors"],
    intestateOnly: true,
    waitDays: 30,
    courtApprovalRequired: true,
    statuteCite: "Tex. Est. Code ch. 205",
    source: "https://statutes.capitol.texas.gov/Docs/ES/htm/ES.205.htm",
    asOf: AS_OF,
    confidence: "medium",
  },
  FL: {
    state: "FL",
    route: "court_simplified",
    routeName: "summary administration",
    capUsd: 150_000,
    capCountsRealProperty: true,
    realPropertyAllowed: "yes",
    excludedFromCap: ["Property exempt from creditors"],
    intestateOnly: false,
    waitDays: null,
    courtApprovalRequired: true,
    noCapAfterYears: 2,
    statuteCite: "Fla. Stat. 735.201",
    source: "https://www.flsenate.gov/Laws/Statutes/2026/735.201",
    asOf: AS_OF,
    confidence: "high",
  },
  NY: {
    state: "NY",
    route: "court_simplified",
    routeName: "voluntary administration",
    capUsd: 50_000,
    capCountsRealProperty: false,
    realPropertyAllowed: "no",
    realPropertyNote: "New York's voluntary administration does not apply to real estate. Real estate generally needs a regular Surrogate's Court proceeding.",
    excludedFromCap: ["Property set aside for the family under EPTL 5-3.1", "Real estate"],
    intestateOnly: false,
    waitDays: null,
    courtApprovalRequired: true,
    statuteCite: "N.Y. SCPA 1301",
    source: "https://www.nysenate.gov/legislation/laws/SCP/1301",
    asOf: AS_OF,
    confidence: "high",
  },
  PA: {
    state: "PA",
    route: "court_simplified",
    routeName: "petition to the Orphans' Court",
    capUsd: 50_000,
    capCountsRealProperty: false,
    realPropertyAllowed: "no",
    realPropertyNote: "Pennsylvania's $50,000 figure leaves out real estate, and real estate needs its own process.",
    excludedFromCap: ["Real estate"],
    intestateOnly: false,
    waitDays: null,
    courtApprovalRequired: true,
    statuteCite: "20 Pa.C.S. 3102",
    source: "https://www.legis.state.pa.us/cfdocs/legis/LI/consCheck.cfm?txtType=HTM&ttl=20&div=0&chpt=31",
    asOf: AS_OF,
    confidence: "high",
  },
  IL: {
    state: "IL",
    route: "affidavit_private",
    routeName: "small estate affidavit",
    capUsd: 150_000,
    capByDeathDate: [
      { from: "2025-08-15", capUsd: 150_000 },
      { from: "1990-01-01", capUsd: 100_000 },
    ],
    capCountsRealProperty: false,
    realPropertyAllowed: "no",
    realPropertyNote: "Illinois real estate does not pass by the small estate affidavit.",
    excludedFromCap: ["Motor vehicles", "Real estate"],
    vehiclesExcluded: true,
    intestateOnly: false,
    waitDays: null,
    courtApprovalRequired: false,
    statuteCite: "755 ILCS 5/25-1",
    source: "https://www.ilga.gov/Documents/legislation/ilcs/documents/075500050K25-1.htm",
    asOf: AS_OF,
    confidence: "high",
  },
  OH: {
    state: "OH",
    route: "court_simplified",
    routeName: "release from administration",
    capUsd: 35_000,
    spouseRule: { capUsd: 100_000, label: "summary release when everything goes to the surviving spouse" },
    capCountsRealProperty: true,
    realPropertyAllowed: "yes",
    excludedFromCap: ["Property that passes outside probate"],
    intestateOnly: false,
    waitDays: null,
    courtApprovalRequired: true,
    statuteCite: "Ohio R.C. 2113.03",
    source: "https://codes.ohio.gov/ohio-revised-code/section-2113.03",
    asOf: AS_OF,
    confidence: "high",
  },
  GA: {
    state: "GA",
    route: "none",
    routeName: "petition for an order that no administration is necessary",
    capUsd: null,
    capCountsRealProperty: false,
    realPropertyAllowed: "yes",
    excludedFromCap: [],
    intestateOnly: true,
    waitDays: null,
    courtApprovalRequired: true,
    statuteCite: "O.C.G.A. 53-2-40",
    source: "https://law.justia.com/codes/georgia/title-53/chapter-2/article-4/section-53-2-40/",
    asOf: AS_OF,
    confidence: "high",
  },
  NC: {
    state: "NC",
    route: "affidavit_private",
    routeName: "collection by affidavit",
    capUsd: 20_000,
    spouseRule: { capUsd: 30_000, label: "limit when the surviving spouse is the only heir" },
    capCountsRealProperty: false,
    realPropertyAllowed: "no",
    realPropertyNote: "In North Carolina the affidavit collects personal property only. Real estate does not pass by it.",
    excludedFromCap: ["Liens and encumbrances on the personal property (the cap uses the value after them)", "Real estate"],
    intestateOnly: false,
    waitDays: 30,
    courtApprovalRequired: false,
    statuteCite: "N.C.G.S. 28A-25-1 and 28A-25-1.1",
    source: "https://law.justia.com/codes/north-carolina/chapter-28a/article-25/section-28a-25-1/",
    asOf: AS_OF,
    confidence: "high",
  },
  MI: {
    state: "MI",
    route: "affidavit_private",
    routeName: "small estate affidavit",
    capUsd: 53_000,
    onlyDeathYears: [2026],
    capCountsRealProperty: false,
    realPropertyAllowed: "no",
    realPropertyNote: "In Michigan the affidavit cannot be used if the estate includes any real estate. A court petition can reach real estate.",
    excludedFromCap: ["Property that passes outside probate"],
    intestateOnly: false,
    waitDays: 28,
    courtApprovalRequired: false,
    statuteCite: "Mich. Comp. Laws 700.3982 and 700.3983",
    source: "https://ezel.ai/surveys/small-estate-affidavit-thresholds/michigan",
    asOf: AS_OF,
    confidence: "medium",
  },
};

/** Facts we hold but never show as numbers (rule R4). */
export const SUPPRESSED_FACTS = [
  "CA: dollar limits for the residence and spousal petitions (Prob. Code 13150, 13151, 13650) are unverified, so only the qualitative answer is shown.",
  "TX: the limit for an intestate estate through the affidavit is not confirmed against statute text, so only the $75,000 figure with its medium confidence is shown.",
  "GA: the $15,000 bank-deposit figure (O.C.G.A. 7-1-239) was not re-opened, so the tool says only that a separate bank deposit rule exists.",
  "OH: wait and fee details, MI and NY fee details: not shown.",
];

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export const stateName = (code: string) => STATE_NAMES[code] ?? code;

export function getRule(state: string): SmallEstateRule | undefined {
  return SMALL_ESTATE_RULES[state];
}

/** Where to look for a state we do not have rules for. A search link, not a claim about any one page. */
export function courtSearchUrl(state: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${stateName(state)} court self-help small estate affidavit`)}`;
}

export type Verdict =
  | "likely_affidavit"
  | "likely_court_simplified"
  | "partial_real_property_needs_other_route"
  | "no_dollar_route_try_petition"
  | "likely_formal_probate"
  | "needs_attorney"
  | "state_not_covered";

export type ReasonCode =
  | "over_cap"
  | "will_exists"
  | "probate_open"
  | "facts_unverified"
  | "date_outside_data"
  | "no_dollar_cap_old_death"
  | "no_dollar_route";

export type Tri = "yes" | "no" | "unknown";

export interface SmallEstateAnswers {
  state: string;
  deathDate: string; // YYYY-MM-DD
  hasWill: Tri;
  personalValue: number;
  vehiclesValue?: number;
  realProperty: "none" | "yes";
  realPropertyValue?: number;
  spouse?: "yes" | "no";
  spouseSoleHeir?: "yes" | "no" | "unsure";
  probateOpen: Tri;
}

export interface SmallEstateResult {
  verdict: Verdict;
  reasonCode?: ReasonCode;
  rule?: SmallEstateRule;
  /** Cap that applied, null = no dollar test. */
  cap?: number | null;
  counted?: number;
  waitUntil?: string | null;
  courtRequired?: boolean;
  /** Higher cap that would apply if the spouse receives everything, when it changes the answer. */
  spouseCapIfSoleHeir?: number;
  willUnknown?: boolean;
  muniment?: boolean;
  notes: string[];
}

const DAY = 86_400_000;

export function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  if (!d) return iso;
  return new Date(d.getTime() + days * DAY).toISOString().slice(0, 10);
}

/** Returns an error message, or null when the date is usable. */
export function validateDeathDate(s: string, today: Date): string | null {
  const d = parseDate(s);
  if (!d) return "Please enter a date.";
  if (d.getTime() > today.getTime()) return "That date is in the future.";
  if (d.getUTCFullYear() < 1990) return "This tool covers deaths from 1990 on. An attorney can help with earlier dates.";
  return null;
}

/** Facts older than 12 months, or unverified, are never shown as numbers (R4). */
export function factUsable(rule: SmallEstateRule, today: Date): boolean {
  if (rule.confidence === "unverified") return false;
  const asOf = parseDate(rule.asOf);
  return !!asOf && today.getTime() - asOf.getTime() <= 365 * DAY;
}

function yearsBefore(today: Date, years: number): string {
  const d = new Date(today.getTime());
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/**
 * The dollar cap for this death date. `null` = no dollar test. `"unknown"` = the date is outside the data we hold.
 */
export function capForDeath(rule: SmallEstateRule, deathDate: string, spouseTakesAll: boolean, today: Date): number | null | "unknown" {
  if (rule.noCapAfterYears && deathDate < yearsBefore(today, rule.noCapAfterYears)) return null;
  if (rule.earliestDeathCovered && deathDate < rule.earliestDeathCovered) return "unknown";
  if (rule.onlyDeathYears && !rule.onlyDeathYears.includes(Number(deathDate.slice(0, 4)))) return "unknown";
  if (rule.spouseRule && spouseTakesAll) return rule.spouseRule.capUsd;
  if (rule.capByDeathDate) {
    const tier = rule.capByDeathDate.find((t) => deathDate >= t.from);
    return tier ? tier.capUsd : "unknown";
  }
  return rule.capUsd;
}

export function smallEstate(a: SmallEstateAnswers, today: Date): SmallEstateResult {
  const rule = getRule(a.state);
  if (!rule) return { verdict: "state_not_covered", notes: [] };
  const notes: string[] = [];
  if (a.probateOpen === "yes") return { verdict: "needs_attorney", reasonCode: "probate_open", rule, notes };
  if (!factUsable(rule, today)) return { verdict: "needs_attorney", reasonCode: "facts_unverified", rule, notes };

  const willUnknown = a.hasWill === "unknown";
  const spouseTakesAll = a.spouse === "yes" && a.spouseSoleHeir === "yes";
  const cap = capForDeath(rule, a.deathDate, spouseTakesAll, today);
  if (cap === "unknown") return { verdict: "needs_attorney", reasonCode: "date_outside_data", rule, notes, willUnknown };

  // Georgia has no dollar route.
  if (a.state === "GA") {
    if (a.hasWill === "yes") return { verdict: "likely_formal_probate", reasonCode: "will_exists", rule, cap: null, willUnknown, notes };
    return { verdict: "no_dollar_route_try_petition", reasonCode: "no_dollar_route", rule, cap: null, willUnknown, notes };
  }

  // The affidavit or petition route is for estates without a will in some states (TX).
  if (rule.intestateOnly && a.hasWill === "yes") {
    return {
      verdict: a.state === "TX" ? "likely_court_simplified" : "likely_formal_probate",
      reasonCode: "will_exists",
      rule,
      cap,
      muniment: a.state === "TX",
      courtRequired: true,
      notes,
    };
  }

  const hasRP = a.realProperty === "yes" && (a.realPropertyValue ?? 0) > 0;
  const personal = Math.max(0, a.personalValue - (rule.vehiclesExcluded ? Math.min(a.vehiclesValue ?? 0, a.personalValue) : 0));
  const rpCounted = rule.capCountsRealProperty && hasRP ? (a.realPropertyValue ?? 0) : 0;
  const counted = personal + rpCounted;
  const waitUntil = rule.waitDays ? addDays(a.deathDate, rule.waitDays) : null;
  const base = { rule, cap, counted, waitUntil, willUnknown, courtRequired: rule.courtApprovalRequired, notes };

  const underCap = cap === null ? true : counted <= cap;
  if (!underCap) {
    // Over the cap only because of real estate that this route cannot transfer anyway.
    if (hasRP && rule.realPropertyAllowed === "separate_route" && personal <= (cap as number)) {
      return { ...base, verdict: "partial_real_property_needs_other_route" };
    }
    const out: SmallEstateResult = { ...base, verdict: "likely_formal_probate", reasonCode: "over_cap" };
    if (rule.spouseRule && a.spouse === "yes" && a.spouseSoleHeir === "unsure" && counted <= rule.spouseRule.capUsd) {
      out.spouseCapIfSoleHeir = rule.spouseRule.capUsd;
    }
    return out;
  }
  if (cap === null && rule.noCapAfterYears) notes.push("no_cap_old_death");
  if (hasRP && (rule.realPropertyAllowed === "no" || rule.realPropertyAllowed === "separate_route")) {
    return { ...base, verdict: "partial_real_property_needs_other_route" };
  }
  return { ...base, verdict: rule.route === "affidavit_private" ? "likely_affidavit" : "likely_court_simplified" };
}

export const SMALL_ESTATE_DISCLAIMER =
  "Eligibility is decided by the court or the institution holding the asset. Thresholds change; the figure shown is the one in effect on the date shown. This is general information, not legal advice.";
