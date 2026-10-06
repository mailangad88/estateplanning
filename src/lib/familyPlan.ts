/**
 * "My family plan" organizer: the shape of a plan, its validation, the progress meter,
 * the plain-language gaps list and the non-sensitive summary the attorney sees.
 *
 * Pure and shared by the browser (drafts kept on the device) and the server (validation,
 * gaps and the summary are always recomputed there). What we never collect: account
 * numbers, Social Security numbers, card numbers, passwords, PINs or full dates of birth.
 * `findSensitiveText` rejects free text that looks like any of them.
 *
 * Gaps are educational prompts for a conversation with an attorney, not legal advice.
 */
import { z } from "zod";
import { FIGURES } from "@/config/figures";
import { US_STATES } from "@/config/firm";
import type { QuizAnswers } from "@/lib/quiz";

export const FAMILY_PLAN_VERSION = 1;

export const SECTION_KEYS = ["people", "assets", "documents", "wishes", "papers"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const SECTION_LABELS: Record<SectionKey, string> = {
  people: "Your people",
  assets: "What you own",
  documents: "Documents you already have",
  wishes: "Your wishes",
  papers: "Where your papers are",
};

export const MARITAL_STATUSES = ["single", "married", "partnered", "divorced", "widowed"] as const;
export const MARITAL_LABELS: Record<(typeof MARITAL_STATUSES)[number], string> = {
  single: "Single",
  married: "Married",
  partnered: "Long-term partner, not married",
  divorced: "Divorced or separated",
  widowed: "Widowed",
};
export const CHILDREN_STATUSES = ["none", "minors", "adults", "both"] as const;
export const CHILDREN_LABELS: Record<(typeof CHILDREN_STATUSES)[number], string> = {
  none: "No children",
  minors: "Yes, under 18",
  adults: "Yes, all adults",
  both: "Both minors and adults",
};

export const ASSET_TYPES = [
  "real_estate",
  "bank",
  "retirement",
  "life_insurance",
  "brokerage",
  "business",
  "vehicle",
  "digital",
  "other",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  real_estate: "Home or other real estate",
  bank: "Bank account",
  retirement: "Retirement account (401(k), IRA)",
  life_insurance: "Life insurance",
  brokerage: "Investment or brokerage account",
  business: "Business interest",
  vehicle: "Vehicle",
  digital: "Digital assets",
  other: "Something else",
};
/** Asset types that can carry a beneficiary, transfer-on-death or payable-on-death designation. */
export const BENEFICIARY_TYPES: readonly AssetType[] = ["real_estate", "bank", "retirement", "life_insurance", "brokerage", "vehicle"];

export const VALUE_RANGES = ["under_50k", "50k_250k", "250k_1m", "1m_5m", "over_5m", "not_sure"] as const;
export type ValueRange = (typeof VALUE_RANGES)[number];
export const VALUE_RANGE_LABELS: Record<ValueRange, string> = {
  under_50k: "Under $50,000",
  "50k_250k": "$50,000 to $250,000",
  "250k_1m": "$250,000 to $1 million",
  "1m_5m": "$1 million to $5 million",
  over_5m: "Over $5 million",
  not_sure: "Not sure",
};
/** Low and high bounds in dollars; null high means open-ended. */
const RANGE_BOUNDS: Record<Exclude<ValueRange, "not_sure">, [number, number | null]> = {
  under_50k: [0, 50_000],
  "50k_250k": [50_000, 250_000],
  "250k_1m": [250_000, 1_000_000],
  "1m_5m": [1_000_000, 5_000_000],
  over_5m: [5_000_000, null],
};

export const TITLINGS = ["sole", "joint_spouse", "joint_other", "trust", "not_sure"] as const;
export type Titling = (typeof TITLINGS)[number];
export const TITLING_LABELS: Record<Titling, string> = {
  sole: "In my name alone",
  joint_spouse: "Jointly with my spouse or partner",
  joint_other: "Jointly with someone else",
  trust: "In a trust",
  not_sure: "Not sure",
};

export const YES_NO_UNSURE = ["yes", "no", "not_sure"] as const;
export type YesNoUnsure = (typeof YES_NO_UNSURE)[number];
export const YES_NO_UNSURE_LABELS: Record<YesNoUnsure, string> = { yes: "Yes", no: "No", not_sure: "Not sure" };

export const DOC_KEYS = ["will", "trust", "financialPoa", "healthcareDirective", "beneficiaryForms"] as const;
export type DocKey = (typeof DOC_KEYS)[number];
export const DOC_LABELS: Record<DocKey, string> = {
  will: "Will",
  trust: "Living trust",
  financialPoa: "Financial power of attorney",
  healthcareDirective: "Healthcare directive or proxy",
  beneficiaryForms: "Beneficiary forms reviewed",
};

export const WISH_KEYS = ["minorChildren", "specialGifts", "funeral", "pets", "other"] as const;
export type WishKey = (typeof WISH_KEYS)[number];
export const WISH_LABELS: Record<WishKey, string> = {
  minorChildren: "Care of minor children",
  specialGifts: "Special gifts (an heirloom, a cause you care about)",
  funeral: "Funeral or memorial wishes",
  pets: "Pets",
  other: "Anything else",
};

// ---------------------------------------------------------------------------
// Sensitive-text guard
// ---------------------------------------------------------------------------

export const SENSITIVE_TEXT_MESSAGE =
  "Please leave out long numbers and secrets. This organizer never stores account, card or Social Security numbers, passwords, PINs or full dates of birth (a birth year is enough). Phone numbers are not needed here either.";

const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const SENSITIVE_PATTERNS: { kind: string; re: RegExp }[] = [
  // Social Security number shapes: 123-45-6789, 123 45 6789
  { kind: "ssn", re: /\b\d{3}[-\s.]\d{2}[-\s.]\d{4}\b/ },
  // Any run of 8 or more digits, allowing single spaces, dots or dashes between them
  // (account, routing, card and policy numbers; also 9-digit SSNs and phone numbers)
  { kind: "long_number", re: /\d(?:[\s.-]?\d){7,}/ },
  // Full dates: 3/14/1980, 14.03.1980, 1980-03-14, March 14, 1980, 14 March 1980
  { kind: "full_date", re: /\b\d{1,2}[/.-]\d{1,2}[/.-](?:\d{2}|\d{4})\b/ },
  { kind: "full_date", re: /\b(?:19|20)\d{2}[/.-]\d{1,2}[/.-]\d{1,2}\b/ },
  { kind: "full_date", re: new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+(?:19|20)\\d{2}\\b`, "i") },
  { kind: "full_date", re: new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\.?,?\\s+(?:19|20)\\d{2}\\b`, "i") },
  // Secrets written out: "password: hunter2", "PIN 4821", "my passcode is tulip7"
  { kind: "secret", re: /\b(?:password|passcode|passwd|pin|cvv|cvc)\s*(?:number)?\s*[:=#]\s*\S+/i },
  { kind: "secret", re: /\b(?:pin|cvv|cvc)\s*(?:number|code)?\s*(?:is\s+)?\d{3,}\b/i },
  {
    kind: "secret",
    re: /\b(?:password|passcode)\s+is\s+(?!(?:in|on|at|with|kept|stored|written|saved|the|my|a|an|also|not)\b)\S+/i,
  },
];

/** The first kind of sensitive data a piece of text seems to contain, or null. */
export function findSensitiveText(text: string): string | null {
  // Year spans like "2015-2018" or "1990 2004" are fine; they are not account numbers.
  const t = text.replace(/\b(?:19|20)\d{2}\s*[-–/ ]\s*(?:19|20)\d{2}\b/g, "years");
  for (const p of SENSITIVE_PATTERNS) if (p.re.test(t)) return p.kind;
  return null;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const thisYear = () => new Date().getUTCFullYear();
const name = z.string().trim().max(80).optional();
const shortText = z.string().trim().max(1000).optional();
const year = z.number().int().min(1900).max(2100).optional();
const state = z.enum(US_STATES).optional();
const id = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/);

const childSchema = z.object({
  id,
  name: z.string().trim().max(80).default(""),
  birthYear: year,
  /** Used when no birth year is given */
  minor: z.boolean().optional(),
});

const assetSchema = z.object({
  id,
  type: z.enum(ASSET_TYPES),
  label: z.string().trim().max(80).default(""),
  valueRange: z.enum(VALUE_RANGES).optional(),
  titling: z.enum(TITLINGS).optional(),
  beneficiary: z.enum(YES_NO_UNSURE).optional(),
  beneficiaryName: name,
});

const docSchema = z.object({
  has: z.enum(YES_NO_UNSURE).optional(),
  yearSigned: year,
  state,
});

export const familyPlanBodySchema = z.object({
  version: z.literal(FAMILY_PLAN_VERSION).default(FAMILY_PLAN_VERSION),
  people: z
    .object({
      homeState: state,
      maritalStatus: z.enum(MARITAL_STATUSES).optional(),
      /** Year of the current marriage, when there is one (used for "will signed before the marriage") */
      marriageYear: year,
      spouseName: name,
      childrenStatus: z.enum(CHILDREN_STATUSES).optional(),
      children: z.array(childSchema).max(20).default([]),
      guardian: name,
      backupGuardian: name,
      executor: name,
      financialAgent: name,
      healthcareAgent: name,
    })
    .default({ children: [] }),
  assets: z.object({ items: z.array(assetSchema).max(60).default([]) }).default({ items: [] }),
  documents: z.object(Object.fromEntries(DOC_KEYS.map((k) => [k, docSchema.optional()])) as Record<DocKey, z.ZodOptional<typeof docSchema>>).default({}),
  wishes: z.object(Object.fromEntries(WISH_KEYS.map((k) => [k, shortText])) as Record<WishKey, typeof shortText>).default({}),
  papers: z.object({ location: shortText }).default({}),
  /** Where prefilled answers came from, shown as "we filled in what you told us earlier" */
  prefill: z
    .object({
      sources: z.array(z.enum(["plan_finder", "life_game", "contact", "lead"])).max(4).default([]),
      /** Documents the visitor said they wanted to plan for in the life game */
      interests: z.array(z.string().trim().max(40).regex(/^[A-Za-z]+$/)).max(20).default([]),
    })
    .optional(),
});

export type FamilyPlanBody = z.infer<typeof familyPlanBodySchema>;
export type FamilyPlanInput = z.input<typeof familyPlanBodySchema>;
export type PlanAsset = FamilyPlanBody["assets"]["items"][number];
export type PlanChild = FamilyPlanBody["people"]["children"][number];
export type PlanDoc = NonNullable<FamilyPlanBody["documents"][DocKey]>;

export function emptyPlan(): FamilyPlanBody {
  return familyPlanBodySchema.parse({});
}

/** Every string in a value with its path, for the sensitive-text check. */
function strings(value: unknown, path: string[] = []): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path: path.join("."), text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, [...path, String(i)]));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, [...path, k]));
  return [];
}

export type PlanValidation =
  | { ok: true; body: FamilyPlanBody }
  | { ok: false; error: string; fields: Record<string, string> };

/** Parses and checks a plan. Free text that looks like an account number, SSN or similar is rejected. */
export function validatePlan(input: unknown): PlanValidation {
  const parsed = familyPlanBodySchema.safeParse(input);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    return { ok: false, error: "Some answers could not be saved. Please check them and try again.", fields };
  }
  const fields: Record<string, string> = {};
  for (const s of strings(parsed.data)) {
    if (s.path === "id" || s.path.endsWith(".id")) continue;
    if (findSensitiveText(s.text)) fields[s.path] = SENSITIVE_TEXT_MESSAGE;
  }
  if (Object.keys(fields).length > 0) return { ok: false, error: SENSITIVE_TEXT_MESSAGE, fields };
  return { ok: true, body: parsed.data };
}

// ---------------------------------------------------------------------------
// Progress, gaps and the summary
// ---------------------------------------------------------------------------

export type SectionStatus = "empty" | "started" | "done";

export interface Gap {
  code: string;
  text: string;
  section: SectionKey;
  /** Asset ids the gap refers to, so the page can point at them. Never labels. */
  assetIds?: string[];
}

export interface FamilyPlanSummary {
  version: number;
  sections: Record<SectionKey, SectionStatus>;
  sectionsDone: number;
  sectionsTotal: number;
  household: {
    homeState?: string;
    maritalStatus?: FamilyPlanBody["people"]["maritalStatus"];
    childrenStatus?: FamilyPlanBody["people"]["childrenStatus"];
    children: number;
    minors: number;
    spouseNamed: boolean;
    guardianNamed: boolean;
    backupGuardianNamed: boolean;
    executorNamed: boolean;
    financialAgentNamed: boolean;
    healthcareAgentNamed: boolean;
  };
  assets: {
    count: number;
    byType: Partial<Record<AssetType, number>>;
    /** Sum of the low and high ends of each asset's range; high is null when a range is open-ended */
    totalLow: number;
    totalHigh: number | null;
    /** Assets whose value range is "not sure" or not given */
    unvalued: number;
    beneficiaryNamed: number;
    beneficiaryMissing: number;
    inTrust: number;
    titledAlone: number;
    titlingNotSure: number;
  };
  documents: Partial<Record<DocKey, PlanDoc>>;
  hasWishes: boolean;
  hasPapersLocation: boolean;
  gaps: Gap[];
}

const filled = (s: string | undefined) => !!s && s.trim().length > 0;

export function isMinor(child: PlanChild, year = thisYear()): boolean {
  return child.birthYear !== undefined ? year - child.birthYear < 18 : child.minor === true;
}

function minorCount(p: FamilyPlanBody["people"], year: number): number {
  const listed = p.children.filter((c) => isMinor(c, year)).length;
  if (listed > 0) return listed;
  // The visitor said they have minor children but has not listed them yet.
  return p.childrenStatus === "minors" || p.childrenStatus === "both" ? 1 : 0;
}

export function sectionStatuses(b: FamilyPlanBody): Record<SectionKey, SectionStatus> {
  const p = b.people;
  const peopleAny =
    !!p.homeState || !!p.maritalStatus || !!p.childrenStatus || p.children.length > 0 ||
    [p.spouseName, p.guardian, p.backupGuardian, p.executor, p.financialAgent, p.healthcareAgent].some(filled);
  const peopleDone = !!p.homeState && !!p.maritalStatus && !!p.childrenStatus && filled(p.executor);
  const items = b.assets.items;
  const assetsDone = items.length > 0 && items.every((a) => !!a.valueRange && !!a.titling);
  const docsAnswered = DOC_KEYS.filter((k) => !!b.documents[k]?.has).length;
  const wishes = WISH_KEYS.some((k) => filled(b.wishes[k]));
  const papers = filled(b.papers.location);
  const st = (done: boolean, any: boolean): SectionStatus => (done ? "done" : any ? "started" : "empty");
  return {
    people: st(peopleDone, peopleAny),
    assets: st(assetsDone, items.length > 0),
    documents: st(docsAnswered === DOC_KEYS.length, docsAnswered > 0),
    wishes: st(wishes, wishes),
    papers: st(papers, papers),
  };
}

const plural = (n: number, one: string, many: string) => `${n === 1 ? "One" : String(n)} ${n === 1 ? one : many}`;

/** Plain-language gaps, most important first. Each one fires only from something the visitor told us. */
export function computeGaps(b: FamilyPlanBody, year = thisYear()): Gap[] {
  const gaps: Gap[] = [];
  const p = b.people;
  const d = b.documents;
  const minors = minorCount(p, year);

  if (minors > 0 && !filled(p.guardian)) {
    gaps.push({ code: "minor_no_guardian", section: "people", text: "Minor children but no guardian named. Without one, a court decides who raises them." });
  } else if (minors > 0 && !filled(p.backupGuardian)) {
    gaps.push({ code: "minor_no_backup_guardian", section: "people", text: "No backup guardian named, in case your first choice cannot serve." });
  }

  const items = b.assets.items;
  const noBeneficiary = (types: AssetType[]) => items.filter((a) => types.includes(a.type) && a.beneficiary !== undefined && a.beneficiary !== "yes");
  const retirement = noBeneficiary(["retirement"]);
  if (retirement.length) {
    gaps.push({
      code: "retirement_no_beneficiary",
      section: "assets",
      text: `${plural(retirement.length, "retirement account", "retirement accounts")} with no beneficiary named (or you are not sure). The beneficiary form usually decides who gets it, not your will.`,
      assetIds: retirement.map((a) => a.id),
    });
  }
  const insurance = noBeneficiary(["life_insurance"]);
  if (insurance.length) {
    gaps.push({
      code: "life_insurance_no_beneficiary",
      section: "assets",
      text: `${plural(insurance.length, "life insurance policy", "life insurance policies")} with no beneficiary named (or you are not sure).`,
      assetIds: insurance.map((a) => a.id),
    });
  }
  const homeAlone = items.filter((a) => a.type === "real_estate" && a.titling === "sole" && a.beneficiary !== "yes");
  if (homeAlone.length) {
    gaps.push({
      code: "home_sole_probate",
      section: "assets",
      text: homeAlone.length === 1
        ? "Home titled in your name alone: it may go through probate."
        : `${homeAlone.length} properties titled in your name alone: they may go through probate.`,
      assetIds: homeAlone.map((a) => a.id),
    });
  }
  const unsureTitle = items.filter((a) => a.titling === "not_sure");
  if (unsureTitle.length) {
    gaps.push({
      code: "titling_not_sure",
      section: "assets",
      text: `Not sure how ${unsureTitle.length === 1 ? "one asset is" : `${unsureTitle.length} assets are`} titled. The title often decides what happens to it.`,
      assetIds: unsureTitle.map((a) => a.id),
    });
  }
  if (d.trust?.has === "yes") {
    const outside = items.filter((a) => ["real_estate", "brokerage", "bank"].includes(a.type) && a.titling !== undefined && a.titling !== "trust" && a.beneficiary !== "yes");
    if (outside.length) {
      gaps.push({
        code: "trust_unfunded",
        section: "assets",
        text: `You have a trust, but ${outside.length === 1 ? "one account or property is" : `${outside.length} accounts or properties are`} not titled in it. A trust only controls what is put into it.`,
        assetIds: outside.map((a) => a.id),
      });
    }
  }

  const missing = (k: DocKey) => d[k]?.has === "no" || d[k]?.has === "not_sure";
  if (missing("will") && (d.trust?.has === "no" || d.trust?.has === "not_sure")) {
    gaps.push({ code: "no_will_or_trust", section: "documents", text: "No will or trust yet. State law would decide who inherits." });
  }
  if (missing("healthcareDirective")) {
    gaps.push({ code: "no_healthcare_directive", section: "documents", text: "No healthcare directive. Doctors and family may not know your wishes or who should speak for you." });
  }
  if (missing("financialPoa")) {
    gaps.push({ code: "no_financial_poa", section: "documents", text: "No financial power of attorney. If you cannot manage your money, your family may need a court's permission." });
  }

  const will = d.will?.has === "yes" ? d.will : undefined;
  if (will?.yearSigned !== undefined) {
    const youngest = Math.max(...p.children.map((c) => c.birthYear ?? 0), 0);
    if (youngest > will.yearSigned) {
      gaps.push({ code: "will_before_child", section: "documents", text: "Will signed before a child was born. It may not mention them." });
    }
    if (p.marriageYear !== undefined && p.marriageYear > will.yearSigned && (p.maritalStatus === "married" || p.maritalStatus === "partnered")) {
      gaps.push({ code: "will_before_marriage", section: "documents", text: "Will signed before your marriage. Marriage can change how a will works." });
    }
    if (year - will.yearSigned > 5) {
      gaps.push({ code: "will_older_than_5_years", section: "documents", text: "Will is more than 5 years old. Laws and families change; it is worth a review." });
    }
  }
  const forms = d.beneficiaryForms;
  if (forms?.has === "no" || forms?.has === "not_sure" || (forms?.has === "yes" && forms.yearSigned !== undefined && year - forms.yearSigned > 5)) {
    gaps.push({ code: "beneficiary_forms_review", section: "documents", text: "Beneficiary forms not reviewed in the last 5 years. Old forms can still name an ex or someone who has died." });
  }
  const home = p.homeState;
  if (home) {
    const elsewhere = DOC_KEYS.filter((k) => d[k]?.has === "yes" && d[k]?.state && d[k]?.state !== home);
    if (elsewhere.length) {
      const states = [...new Set(elsewhere.map((k) => d[k]!.state!))].join(", ");
      gaps.push({ code: "documents_other_state", section: "documents", text: `Documents signed in another state (${states}). They are often still valid, but worth checking against ${home} law.` });
    }
  }

  const totals = assetTotals(items);
  if (totals.low >= FIGURES.federalExemption * 0.8) {
    gaps.push({ code: "estate_tax_watch", section: "assets", text: "Your estimated total may be near the federal estate tax threshold. Planning ahead can matter." });
  }
  return gaps;
}

function assetTotals(items: PlanAsset[]): { low: number; high: number | null; unvalued: number } {
  let low = 0;
  let high: number | null = 0;
  let unvalued = 0;
  for (const a of items) {
    if (!a.valueRange || a.valueRange === "not_sure") {
      unvalued++;
      continue;
    }
    const [l, h] = RANGE_BOUNDS[a.valueRange];
    low += l;
    high = high === null || h === null ? null : high + h;
  }
  return { low, high, unvalued };
}

/** "$300,000 to $1.25 million" style label for a total range. */
export function formatTotal(low: number, high: number | null): string {
  const f = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} million` : `$${n.toLocaleString("en-US")}`;
  if (high === null) return `${f(low)} or more`;
  if (low === 0 && high === 0) return "Not estimated yet";
  return `${f(low)} to ${f(high)}`;
}

/** The structured summary the attorney sees. Counts, ranges and yes/no facts only: no names, labels or free text. */
export function summarizePlan(b: FamilyPlanBody, year = thisYear()): FamilyPlanSummary {
  const sections = sectionStatuses(b);
  const p = b.people;
  const items = b.assets.items;
  const byType: Partial<Record<AssetType, number>> = {};
  for (const a of items) byType[a.type] = (byType[a.type] ?? 0) + 1;
  const totals = assetTotals(items);
  const documents: Partial<Record<DocKey, PlanDoc>> = {};
  for (const k of DOC_KEYS) if (b.documents[k]?.has) documents[k] = { ...b.documents[k] };
  return {
    version: FAMILY_PLAN_VERSION,
    sections,
    sectionsDone: SECTION_KEYS.filter((k) => sections[k] === "done").length,
    sectionsTotal: SECTION_KEYS.length,
    household: {
      homeState: p.homeState,
      maritalStatus: p.maritalStatus,
      childrenStatus: p.childrenStatus,
      children: p.children.length,
      minors: minorCount(p, year),
      spouseNamed: filled(p.spouseName),
      guardianNamed: filled(p.guardian),
      backupGuardianNamed: filled(p.backupGuardian),
      executorNamed: filled(p.executor),
      financialAgentNamed: filled(p.financialAgent),
      healthcareAgentNamed: filled(p.healthcareAgent),
    },
    assets: {
      count: items.length,
      byType,
      totalLow: totals.low,
      totalHigh: totals.high,
      unvalued: totals.unvalued,
      beneficiaryNamed: items.filter((a) => a.beneficiary === "yes").length,
      beneficiaryMissing: items.filter((a) => BENEFICIARY_TYPES.includes(a.type) && (a.beneficiary === "no" || a.beneficiary === "not_sure")).length,
      inTrust: items.filter((a) => a.titling === "trust").length,
      titledAlone: items.filter((a) => a.titling === "sole").length,
      titlingNotSure: items.filter((a) => a.titling === "not_sure").length,
    },
    documents,
    hasWishes: WISH_KEYS.some((k) => filled(b.wishes[k])),
    hasPapersLocation: filled(b.papers.location),
    gaps: computeGaps(b, year),
  };
}

// ---------------------------------------------------------------------------
// Feeding intake and scoring
// ---------------------------------------------------------------------------

/**
 * Flat signals for the lead's capture result (scoring v2 reads estateTaxStatus, beneficiaryGap,
 * trustFunding and estateValue through toolFindings). Ranges become their low end, so the score
 * never assumes more than the visitor told us.
 */
export function organizerSignals(s: FamilyPlanSummary): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {
    sectionsDone: s.sectionsDone,
    gapCount: s.gaps.length,
    assetCount: s.assets.count,
  };
  if (s.assets.totalLow > 0) out.estateValue = s.assets.totalLow;
  const ex = FIGURES.federalExemption;
  if (s.assets.totalLow >= ex) out.estateTaxStatus = "above";
  else if (s.assets.totalLow >= ex * 0.8) out.estateTaxStatus = "approaching";
  if (s.gaps.some((g) => ["retirement_no_beneficiary", "life_insurance_no_beneficiary", "beneficiary_forms_review"].includes(g.code))) out.beneficiaryGap = true;
  if (s.documents.trust?.has === "yes") {
    out.trustFunding = s.gaps.some((g) => g.code === "trust_unfunded") ? "partly" : s.assets.titlingNotSure > 0 ? "unsure" : "funded";
  }
  return out;
}

/** Plan-finder style answers derived from the organizer, so intake starts from the same picture. */
export function answersFromPlan(b: FamilyPlanBody, s: FamilyPlanSummary = summarizePlan(b)): Partial<QuizAnswers> {
  const a: Partial<QuizAnswers> = {};
  if (b.people.maritalStatus) a.maritalStatus = b.people.maritalStatus;
  const minors = s.household.minors > 0;
  const adults = b.people.children.some((c) => !isMinor(c)) || b.people.childrenStatus === "adults" || b.people.childrenStatus === "both";
  if (b.people.childrenStatus || b.people.children.length) a.children = minors && adults ? "both" : minors ? "minors" : adults ? "adults" : "none";
  if (s.assets.count > 0) {
    a.ownsHome = s.assets.byType.real_estate ? "yes" : "no";
    a.ownsBusiness = s.assets.byType.business ? "yes" : "no";
    if (s.assets.unvalued < s.assets.count) {
      const low = s.assets.totalLow;
      a.assetRange = low >= 5_000_000 ? "over_5m" : low >= 1_000_000 ? "1m_5m" : low >= 250_000 ? "250k_1m" : "under_250k";
    }
  }
  const will = b.documents.will?.has;
  const trust = b.documents.trust?.has;
  if (trust === "yes") a.existingDocuments = "trust";
  else if (will === "yes") a.existingDocuments = "will_only";
  else if (will === "no" && trust === "no") a.existingDocuments = "none";
  else if (will || trust) a.existingDocuments = "not_sure";
  return a;
}

// ---------------------------------------------------------------------------
// Prefill from what the visitor told us earlier
// ---------------------------------------------------------------------------

export interface PrefillSources {
  /** Plan finder answers (handed over by the plan finder, or from a linked lead's intake) */
  answers?: Partial<QuizAnswers>;
  /** State from the contact details this browser already gave */
  state?: string;
  /** Plan document keys the visitor chose to plan for in the life game */
  lifeGameDocs?: string[];
  /** Which source the answers came from */
  answersFrom?: "plan_finder" | "lead";
}

const newId = (prefix: string, i: number) => `${prefix}${i}`;

/**
 * Turns earlier answers into a starting plan. Only facts the visitor gave are filled in; nothing
 * is guessed. Returns null when there is nothing to fill.
 */
export function prefillPlan(src: PrefillSources): FamilyPlanBody | null {
  const plan = emptyPlan();
  const sources = new Set<NonNullable<FamilyPlanBody["prefill"]>["sources"][number]>();
  const a = src.answers ?? {};
  const from = src.answersFrom ?? "plan_finder";
  if (src.state && (US_STATES as readonly string[]).includes(src.state)) {
    plan.people.homeState = src.state as FamilyPlanBody["people"]["homeState"];
    sources.add(from === "lead" ? "lead" : "contact");
  }
  if (a.maritalStatus) {
    plan.people.maritalStatus = a.maritalStatus;
    sources.add(from);
  }
  if (a.children) {
    plan.people.childrenStatus = a.children;
    sources.add(from);
  }
  const items: PlanAsset[] = [];
  if (a.ownsHome === "yes") items.push({ id: newId("pf-home-", items.length), type: "real_estate", label: "Our home" });
  if (a.outOfStateProperty === "yes") items.push({ id: newId("pf-oos-", items.length), type: "real_estate", label: "Property in another state" });
  if (a.ownsBusiness === "yes") items.push({ id: newId("pf-biz-", items.length), type: "business", label: "My business" });
  if (items.length) {
    plan.assets.items = items;
    sources.add(from);
  }
  switch (a.existingDocuments) {
    case "none":
      plan.documents.will = { has: "no" };
      plan.documents.trust = { has: "no" };
      break;
    case "will_only":
      plan.documents.will = { has: "yes" };
      plan.documents.trust = { has: "no" };
      break;
    case "trust":
      plan.documents.trust = { has: "yes" };
      break;
    case "not_sure":
      plan.documents.will = { has: "not_sure" };
      break;
  }
  if (a.existingDocuments) sources.add(from);
  const interests = (src.lifeGameDocs ?? []).filter((k) => /^[A-Za-z]{1,40}$/.test(k)).slice(0, 20);
  if (interests.length) sources.add("life_game");
  if (sources.size === 0) return null;
  plan.prefill = { sources: [...sources], interests };
  return plan;
}

/** Fills each empty section of `base` from `extra` (used when a device draft meets a saved plan). */
export function mergePlans(base: FamilyPlanBody, extra: FamilyPlanBody): FamilyPlanBody {
  const st = sectionStatuses(base);
  const out = structuredClone(base);
  if (st.people === "empty") out.people = structuredClone(extra.people);
  if (st.assets === "empty") out.assets = structuredClone(extra.assets);
  if (st.documents === "empty") out.documents = structuredClone(extra.documents);
  if (st.wishes === "empty") out.wishes = structuredClone(extra.wishes);
  if (st.papers === "empty") out.papers = structuredClone(extra.papers);
  if (!out.prefill && extra.prefill) out.prefill = structuredClone(extra.prefill);
  return out;
}

// ---------------------------------------------------------------------------
// Consent shown at save time
// ---------------------------------------------------------------------------

/** Same wording as EDUCATIONAL_DISCLAIMER in src/server/nurture/compliance.ts (a test keeps them equal). */
export const FAMILY_PLAN_DISCLAIMER =
  "This is educational information, not legal advice. Reading it does not create an attorney-client relationship.";

export const FAMILY_PLAN_CONSENT_VERSION = "family-plan-2026-10";

export const FAMILY_PLAN_CONSENT_TEXT = [
  "What we store: the answers in this organizer, encrypted, and a summary of it (counts, value ranges and the gaps list). We never ask for or keep account numbers, Social Security numbers, passwords, PINs or full dates of birth.",
  "Who sees it: only you. If you also ask the firm for a consult using the same email address, the firm's attorneys and intake team working on your matter see the summary, not your names, notes or wishes.",
  "Why: so you can come back to it, and so the attorney starts your consult with the organized picture instead of a blank page.",
  "How to delete it: use \"Delete my data\" on this page at any time. It is removed for good, not hidden.",
];
