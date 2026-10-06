import { FEDERAL, MEDICAID_STATES, type Fact, type StateMedicaid } from "./medicaidRunwayData";

/** Used when a state's own limit is missing, unverified or stale. A common figure, always labeled as an assumption. */
export const DEFAULT_ASSET_LIMIT = 2000;
export const GROWTH_ASSUMPTION_PCT = 4;
const HORIZON = 600; // 50 years
const MAX_AGE_DAYS = 365;

export const CSRA_MIN = FEDERAL.csraMin.value;
export const CSRA_MAX = FEDERAL.csraMax.value;

export interface RunwayInput {
  careCost: number;
  applicantIncome: number;
  countableAssets: number;
  married: boolean;
  assetLimit: number;
  csraRule: "half" | "maximum";
  growthPctPerYear: number;
}

export type RunwayStatus = "months" | "income_covers" | "already_near_limit" | "over_horizon";

export interface Runway {
  months: number | null;
  spendable: number;
  protectedByCsra: number | null;
  shortfallMonthly: number;
  status: RunwayStatus;
}

export function runway(i: RunwayInput): Runway {
  let csra: number | null = null;
  let spendable: number;
  if (i.married) {
    const half = i.countableAssets / 2;
    const target = i.csraRule === "maximum" ? CSRA_MAX : Math.min(Math.max(half, CSRA_MIN), CSRA_MAX);
    csra = Math.min(i.countableAssets, target);
    spendable = i.countableAssets - csra - i.assetLimit;
  } else {
    spendable = i.countableAssets - i.assetLimit;
  }
  if (spendable <= 0) {
    return { months: 0, spendable: 0, protectedByCsra: csra, shortfallMonthly: i.careCost - i.applicantIncome, status: "already_near_limit" };
  }
  let cost = i.careCost;
  let left = spendable;
  let m = 0;
  while (left > 0 && m < HORIZON) {
    const short = cost - i.applicantIncome;
    if (short <= 0) return { months: null, spendable, protectedByCsra: csra, shortfallMonthly: short, status: "income_covers" };
    left -= short;
    m += 1;
    if (m % 12 === 0) cost *= 1 + i.growthPctPerYear / 100;
  }
  return {
    months: left > 0 ? null : m,
    spendable,
    protectedByCsra: csra,
    shortfallMonthly: i.careCost - i.applicantIncome,
    status: left > 0 ? "over_horizon" : "months",
  };
}

/** Rounded range so the result does not look more precise than the inputs. */
export function monthsRange(months: number, spread = 0.15): { low: number; high: number } {
  return { low: Math.floor(months * (1 - spread)), high: Math.ceil(months * (1 + spread)) };
}

export function formatMonths(n: number): string {
  if (n < 12) return `${n} month${n === 1 ? "" : "s"}`;
  const y = Math.floor(n / 12);
  const m = n % 12;
  const ys = `${y} year${y === 1 ? "" : "s"}`;
  return m ? `${ys} ${m} month${m === 1 ? "" : "s"}` : ys;
}

/** R4: a fact is usable only when it is high or medium confidence, has a value, and was checked within 12 months. */
export function usable<T>(fact: Fact<T> | undefined, now: Date = new Date()): fact is Fact<T> & { value: T } {
  if (!fact || fact.value === null || fact.confidence === "unverified") return false;
  const t = Date.parse(fact.asOf);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t <= MAX_AGE_DAYS * 86_400_000;
}

export interface Assumptions {
  assetLimit: number;
  assetLimitFact: (Fact<number> & { value: number }) | null;
  csraRule: "half" | "maximum";
  csraFact: (Fact<"half" | "maximum"> & { value: "half" | "maximum" }) | null;
  lookbackFact: (Fact<number> & { value: number }) | null;
  homeEquityFact: (Fact<number> & { value: number }) | null;
  typicalCost: (Fact<number> & { value: number }) | null;
  /** Names of facts that were suppressed under R4 (for the on-screen banner and the tool_fact_suppressed event). */
  suppressed: string[];
  hasStateData: boolean;
}

export function assumptionsFor(state: string, now: Date = new Date()): Assumptions {
  const row: StateMedicaid | undefined = MEDICAID_STATES[state];
  const pick = <T,>(f: Fact<T> | undefined) => (usable(f, now) ? f : null);
  const assetLimitFact = pick(row?.assetLimit);
  const csraFact = pick(row?.csraRule);
  const lookbackFact = pick(row?.lookbackMonths);
  const homeEquityFact = pick(row?.homeEquityLimit);
  const typicalCost = pick(row?.nursingHomeMonthly);
  const suppressed: string[] = [];
  if (!assetLimitFact) suppressed.push("assetLimit");
  if (!csraFact) suppressed.push("csraRule");
  if (!lookbackFact) suppressed.push("lookbackMonths");
  if (!homeEquityFact) suppressed.push("homeEquityLimit");
  return {
    assetLimit: assetLimitFact?.value ?? DEFAULT_ASSET_LIMIT,
    assetLimitFact,
    csraRule: csraFact?.value ?? "half",
    csraFact,
    lookbackFact,
    homeEquityFact,
    typicalCost,
    suppressed,
    hasStateData: !!row,
  };
}

export type CareSetting = "nursing_home" | "home_or_assisted";

export interface Answers {
  state: string;
  who: "me" | "spouse" | "parent" | "other";
  married: boolean;
  careCost: number;
  applicantIncome: number;
  countableAssets: number;
  ownsHome: boolean;
  homeEquity: number;
  growth: boolean;
  careSetting: CareSetting;
  moveWithin14Days: boolean;
}

export interface Validation { ok: boolean; errors: string[] }

export function validate(a: Pick<Answers, "state" | "careCost" | "countableAssets" | "applicantIncome">): Validation {
  const errors: string[] = [];
  if (!a.state) errors.push("Choose a state.");
  if (!(a.careCost > 0)) errors.push("Enter what care costs per month.");
  if (a.countableAssets < 0 || a.countableAssets > 50_000_000) errors.push("Savings should be between $0 and $50,000,000.");
  if (a.applicantIncome < 0) errors.push("Income cannot be negative.");
  return { ok: errors.length === 0, errors };
}

export interface Outcome {
  runway: Runway;
  range: { low: number; high: number } | null;
  assumptions: Assumptions;
  /** Wider range is used when we had to assume the asset limit or spousal rule. */
  spread: number;
  homeEquityWarning: boolean;
  urgent: boolean;
  crisis: boolean;
}

export function compute(a: Answers, now: Date = new Date()): Outcome {
  const as = assumptionsFor(a.state, now);
  const assumed = !as.assetLimitFact || (a.married && !as.csraFact);
  const spread = assumed ? 0.25 : 0.15;
  const r = runway({
    careCost: a.careCost,
    applicantIncome: a.applicantIncome,
    countableAssets: a.countableAssets,
    married: a.married,
    assetLimit: as.assetLimit,
    csraRule: as.csraRule,
    growthPctPerYear: a.growth ? GROWTH_ASSUMPTION_PCT : 0,
  });
  const range = r.status === "months" && r.months !== null && r.months > 0 ? monthsRange(r.months, spread) : null;
  return {
    runway: r,
    range,
    assumptions: as,
    spread,
    homeEquityWarning: a.ownsHome && a.homeEquity > FEDERAL.homeEquityMin.value,
    urgent: a.moveWithin14Days,
    crisis: r.status === "already_near_limit" || (r.months !== null && r.months < 12 && r.status === "months"),
  };
}
