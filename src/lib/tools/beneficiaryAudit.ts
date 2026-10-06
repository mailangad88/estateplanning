import { COMMUNITY_PROPERTY_STATES, FLAG_DEFS, type Sev } from "./beneficiaryAuditData";

export type AccountKind = "plan_401k" | "ira" | "roth" | "life" | "annuity" | "hsa" | "bank_pod" | "brokerage_tod" | "plan_529";
export type Primary =
  | "spouse" | "adult_children" | "minor_child" | "other_adult" | "ex_spouse"
  | "estate" | "trust" | "charity" | "special_needs" | "deceased" | "blank";
export type Contingent = "yes" | "no" | "unsure";
export type LastReview = "lt3" | "3_5" | "gt5" | "never";
export type Marital = "single" | "married" | "divorced" | "widowed";
export type LifeEvent = "marriage" | "divorce" | "birth_adoption" | "death" | "new_plan" | "none";
export type Band = "looks_current" | "few_things" | "several_risks" | "fix_soon";

export interface Entry { primary: Primary; contingent: Contingent; lastReview: LastReview; waiver?: boolean }
export interface Globals { marital: Marital; events: LifeEvent[]; cp: boolean }
export interface Flag { code: string; sev: Sev; points: number; text: string; ask: string; source: string; cite: string; asOf: string }

export const ACCOUNT_OPTIONS: { value: AccountKind; label: string }[] = [
  { value: "plan_401k", label: "401(k), 403(b) or other workplace plan" },
  { value: "ira", label: "Traditional IRA" },
  { value: "roth", label: "Roth IRA" },
  { value: "life", label: "Life insurance" },
  { value: "annuity", label: "Annuity" },
  { value: "hsa", label: "Health savings account" },
  { value: "bank_pod", label: "Bank account with a payable-on-death beneficiary" },
  { value: "brokerage_tod", label: "Brokerage account with a transfer-on-death beneficiary" },
  { value: "plan_529", label: "529 college account" },
];

export const PRIMARY_OPTIONS: { value: Primary; label: string }[] = [
  { value: "spouse", label: "My spouse" },
  { value: "adult_children", label: "Adult children" },
  { value: "minor_child", label: "A child under 18" },
  { value: "other_adult", label: "Another adult" },
  { value: "ex_spouse", label: "A former spouse" },
  { value: "estate", label: "My estate" },
  { value: "trust", label: "A trust" },
  { value: "charity", label: "A charity" },
  { value: "special_needs", label: "A person with a disability or on benefits" },
  { value: "deceased", label: "Someone who has died" },
  { value: "blank", label: "No one, or I'm not sure" },
];

export const EVENT_OPTIONS: { value: LifeEvent; label: string }[] = [
  { value: "marriage", label: "Marriage" },
  { value: "divorce", label: "Divorce" },
  { value: "birth_adoption", label: "Birth or adoption" },
  { value: "death", label: "Someone you named died" },
  { value: "new_plan", label: "New trust or will" },
];

export const BAND_LABEL: Record<Band, string> = {
  looks_current: "Looks current",
  few_things: "A few things to check",
  several_risks: "Several possible risks",
  fix_soon: "Worth fixing soon",
};

export const BAND_LINE: Record<Band, string> = {
  looks_current: "Nothing here stood out as a risk on its own. Forms still need a check after life changes.",
  few_things: "A few items are worth a closer look.",
  several_risks: "Several of these forms could send money somewhere you may not intend.",
  fix_soon: "Some of these forms may not match what you want. The good news: most can be changed with a form from the plan or company.",
};

const RETIREMENT = new Set<string>(["plan_401k", "ira", "roth"]);
const CONT = new Set<string>(["plan_401k", "ira", "roth", "life", "annuity", "hsa", "plan_529"]);
const ESTATE_BAD = new Set<string>(["plan_401k", "ira", "roth", "life", "annuity"]);
const POD = new Set<string>(["bank_pod", "brokerage_tod", "tod_deed"]);

export const isCommunityProperty = (state: string) => COMMUNITY_PROPERTY_STATES.states.includes(state.toUpperCase());

function flag(code: string, points: number): Flag {
  const d = FLAG_DEFS[code];
  return { code, sev: d.sev, points, text: d.text, ask: d.ask, source: d.source, cite: d.cite, asOf: d.asOf };
}

export function auditAccount(kind: string, e: Entry, g: Globals): Flag[] {
  const f: Flag[] = [];
  const married = g.marital === "married";
  if (e.primary === "blank") f.push(flag("no_designation", 35));
  if (e.primary === "deceased") f.push(flag("deceased_beneficiary", 40));
  if (e.primary === "ex_spouse") f.push(flag("ex_spouse", 50));
  if (e.primary === "minor_child") f.push(flag("minor_named", 30));
  if (e.primary === "special_needs" && !POD.has(kind)) f.push(flag("special_needs_direct", 40));
  if (e.primary === "estate" && ESTATE_BAD.has(kind)) f.push(flag("estate_named", 25));
  if (e.primary === "estate" && POD.has(kind)) f.push(flag("estate_defeats_pod", 10));
  if (e.primary === "trust" && (RETIREMENT.has(kind) || kind === "annuity")) f.push(flag("trust_named_check", 15));
  if (kind === "plan_401k" && married && !e.waiver && !["spouse", "blank", "deceased"].includes(e.primary)) f.push(flag("spousal_consent", 20));
  if (kind === "hsa" && e.primary !== "blank" && (g.marital !== "married" || e.primary !== "spouse")) f.push(flag("hsa_nonspouse", 15));
  if (RETIREMENT.has(kind) && e.primary === "adult_children") f.push(flag("ten_year_rule", 5));
  if ((RETIREMENT.has(kind) || kind === "annuity" || kind === "life") && g.cp && married && !["spouse", "blank"].includes(e.primary)) f.push(flag("community_property_check", 10));
  if (CONT.has(kind)) {
    if (e.contingent === "no") f.push(flag("no_contingent", 15));
    if (e.contingent === "unsure") f.push(flag("contingent_unknown", 10));
  }
  if (e.lastReview === "gt5") f.push(flag("stale_review", 15));
  if (e.lastReview === "3_5") f.push(flag("aging_review", 5));
  if (e.lastReview === "never") f.push(flag("never_reviewed", 20));
  const eventPoints = Math.min(15, 5 * g.events.filter((x) => x !== "none").length);
  if (eventPoints > 0) f.push(flag("life_event_since", eventPoints));
  return f;
}

export interface AccountResult { kind: string; flags: Flag[]; score: number; notes: string[] }
export interface AuditResult { per: AccountResult[]; overall: number; band: Band; worst: AccountResult; hasHigh: boolean; highCount: number }

export function audit(entries: Record<string, Entry>, g: Globals): AuditResult | null {
  const keys = Object.keys(entries);
  if (keys.length === 0) return null;
  const per = keys.map((kind) => {
    const e = entries[kind];
    const flags = auditAccount(kind, e, g);
    const notes: string[] = [];
    if (e.primary === "charity" && RETIREMENT.has(kind)) notes.push("Naming a charity on a retirement account is common because the charity generally doesn't owe income tax.");
    if (g.marital === "divorced" && e.primary === "spouse") notes.push("If this is a former spouse, choose \"A former spouse\".");
    const penalty = Math.min(100, flags.reduce((s, x) => s + x.points, 0));
    return { kind, flags, score: 100 - penalty, notes };
  });
  const overall = Math.round(per.reduce((s, p) => s + p.score, 0) / per.length);
  let band: Band = overall >= 85 ? "looks_current" : overall >= 65 ? "few_things" : overall >= 40 ? "several_risks" : "fix_soon";
  const highCount = per.reduce((n, p) => n + p.flags.filter((x) => x.sev === "high").length, 0);
  const hasHigh = highCount > 0;
  if (hasHigh && band === "looks_current") band = "few_things";
  const worst = per.slice().sort((a, b) => a.score - b.score)[0];
  return { per, overall, band, worst, hasHigh, highCount };
}

/** Consult note shown for fix_soon, several_risks, or any of these flags. */
export function needsConsultNote(r: AuditResult): boolean {
  if (r.band === "fix_soon" || r.band === "several_risks") return true;
  return r.per.some((p) => p.flags.some((f) => ["ex_spouse", "minor_named", "special_needs_direct"].includes(f.code)));
}
