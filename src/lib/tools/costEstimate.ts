import {
  CA_STATUTORY_TIERS,
  FEDERAL_ESTATE_TAX_EXEMPTION_2026,
  INHERITANCE_TAX_STATES,
  STATE_ESTATE_TAX_THRESHOLDS,
  toolConfig,
} from "@/config/tools";

export interface CostInput {
  /** Gross value of what would pass through probate, in dollars (home, accounts without beneficiaries, etc.) */
  estateValue: number;
  state: string;
  /** Number of other states where real estate is owned */
  otherStatesWithProperty: number;
}

export interface Range {
  low: number;
  high: number;
}

export interface CostEstimate {
  method: "ca_statutory" | "general_range";
  probateCost: Range;
  /** Probate cost as a percent of the estate, rounded to one decimal */
  probatePercent: Range;
  durationMonths: Range;
  ancillaryCost: Range;
  notes: string[];
}

/** Statutory fee for one recipient (the executor or the attorney) under the California schedule. */
export function caStatutoryFee(gross: number): number {
  let fee = 0;
  let floor = 0;
  for (const tier of CA_STATUTORY_TIERS) {
    if (gross <= floor) break;
    const slice = Math.min(gross, tier.upTo) - floor;
    fee += slice * tier.rate;
    floor = tier.upTo;
  }
  return Math.round(fee);
}

const round = (n: number) => Math.round(n / 100) * 100;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * Rough, general estimate of what probate could cost without a funded trust.
 * Educational only: real costs depend on the estate, the state and whether anyone contests.
 */
export function estimateProbate(input: CostInput): CostEstimate {
  const value = Math.max(0, Math.min(input.estateValue, 1_000_000_000));
  const extraStates = Math.max(0, Math.min(Math.floor(input.otherStatesWithProperty), 10));
  const p = toolConfig.probate;
  const ancillaryCost = { low: extraStates * p.ancillaryPerStateDollars.low, high: extraStates * p.ancillaryPerStateDollars.high };
  const notes: string[] = [];

  let base: Range;
  let method: CostEstimate["method"];
  if (input.state === "CA") {
    method = "ca_statutory";
    const each = caStatutoryFee(value);
    // Executor and attorney each receive the statutory amount; executors may waive theirs.
    base = { low: each + p.filingCostsDollars.low, high: each * 2 + p.filingCostsDollars.high };
    notes.push(
      "California sets probate attorney and executor fees by statute, based on the gross value of the estate, not its value after debts.",
      "The low end assumes a family member serves as executor and waives the executor fee.",
    );
    if (value > 25_000_000) notes.push("Above $25 million, the court decides the fee for the excess.");
  } else {
    method = "general_range";
    base = { low: (value * p.generalCostPercent.low) / 100, high: (value * p.generalCostPercent.high) / 100 };
    notes.push(
      `Uses a commonly cited range of ${p.generalCostPercent.low}% to ${p.generalCostPercent.high}% of the estate. Costs in your state may be lower or higher.`,
    );
  }
  if (extraStates > 0) {
    notes.push("Real estate in another state usually needs a separate (ancillary) probate there.");
  }

  const stateThreshold = STATE_ESTATE_TAX_THRESHOLDS[input.state];
  if (stateThreshold !== undefined && value > stateThreshold) {
    notes.push("Your state has its own estate tax, and an estate this size may be above its exemption. An attorney can explain how it applies.");
  }
  if (INHERITANCE_TAX_STATES.includes(input.state)) {
    notes.push("Your state has an inheritance tax that some heirs pay, depending on their relationship to the person who died.");
  }
  if (value > FEDERAL_ESTATE_TAX_EXEMPTION_2026) {
    notes.push("An estate this size may be above the federal estate tax exemption. Estate tax is separate from probate costs and is not included here.");
  }

  const probateCost = { low: round(base.low + ancillaryCost.low), high: round(base.high + ancillaryCost.high) };
  return {
    method,
    probateCost,
    probatePercent: { low: pct(probateCost.low, value), high: pct(probateCost.high, value) },
    durationMonths: { ...p.generalDurationMonths },
    ancillaryCost,
    notes,
  };
}
