import { FIGURES, FIGURE_DETAILS } from "@/config/figures";
import { STATE_ESTATE_TAX_THRESHOLDS } from "@/config/tools";
import {
  ESTATE_TAX_META,
  FEDERAL_SOURCE,
  INHERITANCE_TAX_META,
  PA_EARLY_PAYMENT_DISCOUNT,
  STATE_NAMES,
  type Confidence,
} from "./deathTaxData";

export type Status = "well_below" | "approaching" | "above" | "could_be_either" | "cliff_zone" | "above_cliff";
export type NetWorthBand = "under_1m" | "1m_3m" | "3m_5m" | "5m_8m" | "8m_15m" | "15m_30m" | "over_30m";
export type Heirs = "spouse" | "children" | "siblings" | "others";

export const NET_WORTH_BANDS: { value: NetWorthBand; label: string; low: number; high: number; mid: number }[] = [
  { value: "under_1m", label: "Under $1 million", low: 0, high: 1_000_000, mid: 500_000 },
  { value: "1m_3m", label: "$1 million to $3 million", low: 1_000_000, high: 3_000_000, mid: 2_000_000 },
  { value: "3m_5m", label: "$3 million to $5 million", low: 3_000_000, high: 5_000_000, mid: 4_000_000 },
  { value: "5m_8m", label: "$5 million to $8 million", low: 5_000_000, high: 8_000_000, mid: 6_500_000 },
  { value: "8m_15m", label: "$8 million to $15 million", low: 8_000_000, high: 15_000_000, mid: 11_500_000 },
  { value: "15m_30m", label: "$15 million to $30 million", low: 15_000_000, high: 30_000_000, mid: 22_500_000 },
  { value: "over_30m", label: "Over $30 million", low: 30_000_000, high: Infinity, mid: 35_000_000 },
];

export const FEDERAL_TOP_RATE_PCT = Math.round(FIGURES.federalTopRate * 100);

export function exposure(value: number, exemption: number, opts?: { cliff?: boolean; cliffPct?: number }): Status {
  if (opts?.cliff) {
    const limit = exemption * ((opts.cliffPct ?? 105) / 100);
    if (value > limit) return "above_cliff";
    if (value > exemption) return "cliff_zone";
  }
  if (value > exemption) return "above";
  return value >= exemption * 0.5 ? "approaching" : "well_below";
}

/** Status for a value known only to lie within a band, judged by the band's edges. */
export function exposureForRange(
  low: number,
  high: number,
  mid: number,
  exemption: number,
  opts?: { cliff?: boolean; cliffPct?: number },
): Status {
  const cliffLimit = opts?.cliff ? exemption * ((opts.cliffPct ?? 105) / 100) : exemption;
  if (low > cliffLimit) return exposure(low, exemption, opts);
  if (high <= exemption) return exposure(mid, exemption, opts);
  if (!opts?.cliff && low > exemption) return "above";
  return "could_be_either";
}

export function paInheritanceTax(amounts: { lineal: number; sibling: number; other: number }, paidWithin3Months: boolean): number {
  const raw = amounts.lineal * 0.045 + amounts.sibling * 0.12 + amounts.other * 0.15;
  return Math.round(raw * (paidWithin3Months ? 1 - PA_EARLY_PAYMENT_DISCOUNT : 1));
}

/** True when the fact is usable: not unverified and not older than about 12 months. asOf is a year or an ISO date. */
export function isUsable(fact: { asOf: string; confidence: Confidence }, now: Date): boolean {
  if (fact.confidence === "unverified") return false;
  const year = Number(fact.asOf.slice(0, 4));
  if (!Number.isFinite(year)) return false;
  return year >= now.getFullYear() - 1;
}

export interface DeathTaxInput {
  state: string;
  marital: "single" | "married";
  netWorth: NetWorthBand | null;
  /** Exact value overrides the band when greater than zero. */
  exactNetWorth?: number;
  propertyState?: string;
  propertyValue?: number;
  heirs?: Heirs;
  heirAmount?: number;
  now?: Date;
}

export interface StateEstateResult {
  kind: "none" | "estate_tax";
  exemption: number | null;
  topRatePct: number | null;
  status: Status | null;
  cliff: boolean;
  limit: number | null;
  portable: boolean | null;
  note?: string;
  asOf?: string;
  confidence?: Confidence;
  source?: string;
  cite?: string;
  /** True when the number was withheld (stale or unverified); the yes/no is still shown. */
  suppressed: boolean;
}

export interface InheritanceResult {
  hasTax: boolean;
  computable: boolean;
  /** Only set for Pennsylvania, from the visitor's own amount. */
  taxUsd: number | null;
  taxEarlyUsd: number | null;
  rate: number | null;
  spouseExempt: boolean;
  note?: string;
  asOf?: string;
  source?: string;
  cite?: string;
  confidence?: Confidence;
}

export interface PropertyResult {
  state: string;
  hasEstateTax: boolean;
  hasInheritanceTax: boolean;
  status: Status | null;
  exemption: number | null;
  suppressed: boolean;
}

export interface DeathTaxResult {
  state: string;
  stateName: string;
  value: number | null;
  valueIsExact: boolean;
  federal: {
    status: Status;
    exemption: number;
    suppressed: boolean;
    portabilityNote: boolean;
    asOf: string;
    source: string;
  };
  stateEstate: StateEstateResult;
  inheritance: InheritanceResult;
  property: PropertyResult | null;
  tags: string[];
  suppressedFields: string[];
  showExactPrompt: boolean;
}

export function stateHasInheritanceTax(code: string): boolean {
  return Boolean(INHERITANCE_TAX_META[code]);
}
export function stateHasEstateTax(code: string): boolean {
  return STATE_ESTATE_TAX_THRESHOLDS[code] !== undefined && Boolean(ESTATE_TAX_META[code]);
}

export function needsHeirs(state: string, propertyState?: string): boolean {
  return stateHasInheritanceTax(state) || Boolean(propertyState && propertyState !== state && stateHasInheritanceTax(propertyState));
}

function stateEstate(code: string, value: { low: number; high: number; mid: number } | null, now: Date, suppressedFields: string[]): StateEstateResult {
  const none: StateEstateResult = { kind: "none", exemption: null, topRatePct: null, status: null, cliff: false, limit: null, portable: null, suppressed: false };
  if (!stateHasEstateTax(code)) return none;
  const meta = ESTATE_TAX_META[code];
  const exemption = STATE_ESTATE_TAX_THRESHOLDS[code] as number;
  const cliff = meta.cliffPct !== undefined;
  const base: StateEstateResult = {
    kind: "estate_tax",
    exemption,
    topRatePct: meta.topRatePct,
    status: null,
    cliff,
    limit: cliff ? Math.round(exemption * (meta.cliffPct! / 100)) : null,
    portable: meta.portable,
    note: meta.note,
    asOf: meta.asOf,
    confidence: meta.confidence,
    source: meta.source,
    cite: meta.cite,
    suppressed: false,
  };
  if (!isUsable(meta, now)) {
    suppressedFields.push(`state_threshold:${code}`);
    return { ...base, exemption: null, limit: null, suppressed: true };
  }
  if (!value) return base;
  const opts = cliff ? { cliff: true, cliffPct: meta.cliffPct } : undefined;
  base.status = value.low === value.high ? exposure(value.mid, exemption, opts) : exposureForRange(value.low, value.high, value.mid, exemption, opts);
  return base;
}

export function checkDeathTax(input: DeathTaxInput): DeathTaxResult {
  const now = input.now ?? new Date();
  const suppressedFields: string[] = [];
  const band = NET_WORTH_BANDS.find((b) => b.value === input.netWorth) ?? null;
  const exact = input.exactNetWorth && input.exactNetWorth > 0 ? input.exactNetWorth : null;
  const range = exact !== null ? { low: exact, high: exact, mid: exact } : band;
  const value = exact ?? band?.mid ?? null;
  const married = input.marital === "married";

  // Federal
  const fedFact = FIGURE_DETAILS.federalExemption;
  const fedUsable = isUsable({ asOf: fedFact.asOf, confidence: "high" }, now);
  if (!fedUsable) suppressedFields.push("federal_exemption");
  const fedExemption = FIGURES.federalExemption * (married ? 2 : 1);
  let fedStatus: Status = "could_be_either";
  if (range && fedUsable) {
    fedStatus = range.low === range.high ? exposure(range.mid, fedExemption) : exposureForRange(range.low, range.high, range.mid, fedExemption);
  }

  // State
  const state = input.state;
  const se = stateEstate(state, range, now, suppressedFields);

  // Inheritance
  const inhMeta = INHERITANCE_TAX_META[state];
  const inheritance: InheritanceResult = {
    hasTax: Boolean(inhMeta),
    computable: false,
    taxUsd: null,
    taxEarlyUsd: null,
    rate: null,
    spouseExempt: false,
  };
  if (inhMeta) {
    inheritance.note = inhMeta.note;
    inheritance.asOf = inhMeta.asOf;
    inheritance.source = inhMeta.source;
    inheritance.cite = inhMeta.cite;
    inheritance.confidence = inhMeta.confidence;
    if (input.heirs === "spouse") inheritance.spouseExempt = true;
    if (inhMeta.computable && isUsable(inhMeta, now)) {
      inheritance.computable = true;
      if (input.heirs === "spouse") {
        inheritance.taxUsd = 0;
        inheritance.taxEarlyUsd = 0;
        inheritance.rate = 0;
      } else if (input.heirs && input.heirAmount && input.heirAmount > 0) {
        const amounts = { lineal: 0, sibling: 0, other: 0 };
        if (input.heirs === "children") amounts.lineal = input.heirAmount;
        if (input.heirs === "siblings") amounts.sibling = input.heirAmount;
        if (input.heirs === "others") amounts.other = input.heirAmount;
        inheritance.rate = inhMeta.classes.find((c) => c.heir === input.heirs)?.rate ?? null;
        inheritance.taxUsd = paInheritanceTax(amounts, false);
        inheritance.taxEarlyUsd = paInheritanceTax(amounts, true);
      }
    } else {
      suppressedFields.push(`inheritance_rates:${state}`);
    }
  }

  // Property in another state
  let property: PropertyResult | null = null;
  const ps = input.propertyState && input.propertyState !== state ? input.propertyState : undefined;
  if (ps) {
    const pv = input.propertyValue && input.propertyValue > 0 ? input.propertyValue : null;
    const hasEstate = stateHasEstateTax(ps);
    let status: Status | null = null;
    let suppressed = false;
    const meta = ESTATE_TAX_META[ps];
    if (hasEstate && !isUsable(meta, now)) {
      suppressed = true;
      suppressedFields.push(`state_threshold:${ps}`);
    } else if (hasEstate && pv !== null) {
      const ex = STATE_ESTATE_TAX_THRESHOLDS[ps] as number;
      status = exposure(pv, ex, meta.cliffPct ? { cliff: true, cliffPct: meta.cliffPct } : undefined);
    }
    property = {
      state: ps,
      hasEstateTax: hasEstate,
      hasInheritanceTax: stateHasInheritanceTax(ps),
      status,
      exemption: hasEstate && !suppressed ? (STATE_ESTATE_TAX_THRESHOLDS[ps] as number) : null,
      suppressed,
    };
  }

  const watch = (s: Status | null) => s !== null && s !== "well_below";
  const tags = ["tool_death_tax"];
  const watching = watch(fedStatus) || watch(se.status) || watch(property?.status ?? null);
  if (watching) tags.push("estate_tax_watch");
  if (range && ((range?.low ?? 0) >= 5_000_000)) tags.push("high_net_worth");
  if (ps) tags.push("out_of_state_property");
  if (inheritance.hasTax || property?.hasInheritanceTax) tags.push("inheritance_tax_state");

  return {
    state,
    stateName: STATE_NAMES[state] ?? state,
    value,
    valueIsExact: exact !== null,
    federal: {
      status: fedStatus,
      exemption: fedExemption,
      suppressed: !fedUsable,
      portabilityNote: married,
      asOf: fedFact.asOf,
      source: FEDERAL_SOURCE,
    },
    stateEstate: se,
    inheritance,
    property,
    tags,
    suppressedFields,
    showExactPrompt: !exact && (fedStatus === "could_be_either" || se.status === "could_be_either"),
  };
}

export const STATUS_LABEL: Record<Status, string> = {
  well_below: "Well below",
  approaching: "Approaching",
  above: "Above",
  could_be_either: "Could be either side",
  cliff_zone: "In the cliff zone",
  above_cliff: "Above the cliff",
};
