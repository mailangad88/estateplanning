/**
 * Fee rule engine.
 *
 * Every charge comes from a fee rule. Rates are editable, but each fee type is only
 * allowed under certain business structures, because a non-lawyer taking a share of
 * legal fees (ABA Model Rule 5.4) or being paid for a recommendation (Rule 7.2) is
 * prohibited in most states. Percentage-of-fee and per-signed-retainer rules stay
 * locked unless the structure permits them AND counsel approval is recorded.
 */

export type BusinessStructure =
  | "in_firm" // Model A: platform is the firm's own marketing and intake department
  | "marketing_services" // Model B: separate company paid flat fees
  | "certified_lrs" // Model C: state-certified lawyer referral service
  | "abs" // Model D: alternative business structure (Arizona, Utah)
  | "saas"; // Model E: firm licenses the software

export type FeeType =
  | "monthly_retainer"
  | "per_lead"
  | "per_consult_booked"
  | "ad_spend_passthrough"
  | "saas_seat"
  | "percent_of_fee"
  | "per_signed_retainer"
  | "comp_plan_accrual";

type Permission = "allowed" | "needs_counsel_approval" | "prohibited";

const MATRIX: Record<FeeType, Record<BusinessStructure, Permission>> = {
  monthly_retainer: { in_firm: "prohibited", marketing_services: "allowed", certified_lrs: "allowed", abs: "allowed", saas: "allowed" },
  per_lead: { in_firm: "prohibited", marketing_services: "allowed", certified_lrs: "allowed", abs: "allowed", saas: "prohibited" },
  per_consult_booked: { in_firm: "prohibited", marketing_services: "needs_counsel_approval", certified_lrs: "needs_counsel_approval", abs: "allowed", saas: "prohibited" },
  ad_spend_passthrough: { in_firm: "prohibited", marketing_services: "allowed", certified_lrs: "prohibited", abs: "allowed", saas: "prohibited" },
  saas_seat: { in_firm: "prohibited", marketing_services: "allowed", certified_lrs: "allowed", abs: "allowed", saas: "allowed" },
  percent_of_fee: { in_firm: "prohibited", marketing_services: "prohibited", certified_lrs: "needs_counsel_approval", abs: "needs_counsel_approval", saas: "prohibited" },
  per_signed_retainer: { in_firm: "prohibited", marketing_services: "prohibited", certified_lrs: "needs_counsel_approval", abs: "needs_counsel_approval", saas: "prohibited" },
  // Firm-wide compensation plan for non-lawyer staff (Rule 5.4(a)(3)). Reported to payroll, never invoiced.
  comp_plan_accrual: { in_firm: "needs_counsel_approval", marketing_services: "prohibited", certified_lrs: "prohibited", abs: "allowed", saas: "prohibited" },
};

export interface FeeRule {
  id: string;
  feeType: FeeType;
  /** Flat amount in cents (flat fee types) */
  amountCents?: number;
  /** Percentage, 0 to 100 (percent_of_fee, ad_spend_passthrough management fee, comp_plan_accrual) */
  percent?: number;
  /** Optional cap per billing period, in cents */
  capCents?: number;
  state?: string;
  lawyerId?: string;
  effectiveFrom: string; // ISO date
  effectiveTo?: string; // ISO date, exclusive
  /** Date an ethics counsel approved this rule for this structure and state */
  counselApprovedAt?: string;
}

export interface RuleCheck {
  allowed: boolean;
  reason: string;
}

export function checkRule(rule: FeeRule, structure: BusinessStructure): RuleCheck {
  const permission = MATRIX[rule.feeType][structure];
  if (permission === "prohibited") {
    return { allowed: false, reason: `${rule.feeType} is not permitted under the ${structure} structure` };
  }
  if (permission === "needs_counsel_approval" && !rule.counselApprovedAt) {
    return { allowed: false, reason: `${rule.feeType} under ${structure} is locked until counsel approval is recorded` };
  }
  if (rule.percent !== undefined && (rule.percent < 0 || rule.percent > 100)) {
    return { allowed: false, reason: "percent must be between 0 and 100" };
  }
  if (rule.amountCents !== undefined && rule.amountCents < 0) {
    return { allowed: false, reason: "amount cannot be negative" };
  }
  return { allowed: true, reason: permission === "allowed" ? "allowed" : `counsel approved on ${rule.counselApprovedAt}` };
}

export type BillableEventType =
  | "month_started"
  | "lead_delivered"
  | "consult_booked"
  | "ad_spend_posted"
  | "seat_active"
  | "fee_collected"
  | "retainer_signed";

export interface BillableEvent {
  id: string;
  type: BillableEventType;
  occurredAt: string; // ISO datetime
  state?: string;
  lawyerId?: string;
  /** Spend or collected fee, in cents, for amount-based events */
  amountCents?: number;
}

const EVENT_FOR: Record<FeeType, BillableEventType | null> = {
  monthly_retainer: "month_started",
  per_lead: "lead_delivered",
  per_consult_booked: "consult_booked",
  ad_spend_passthrough: "ad_spend_posted",
  saas_seat: "seat_active",
  percent_of_fee: "fee_collected",
  per_signed_retainer: "retainer_signed",
  comp_plan_accrual: null,
};

export interface ChargeLine {
  ruleId: string;
  eventId: string;
  feeType: FeeType;
  amountCents: number;
}

export interface ChargeResult {
  lines: ChargeLine[];
  totalCents: number;
  blockedRules: { ruleId: string; reason: string }[];
}

function inEffect(rule: FeeRule, at: string): boolean {
  const day = at.slice(0, 10);
  return day >= rule.effectiveFrom && (!rule.effectiveTo || day < rule.effectiveTo);
}

function matches(rule: FeeRule, event: BillableEvent): boolean {
  if (EVENT_FOR[rule.feeType] !== event.type) return false;
  if (rule.state && rule.state !== event.state) return false;
  if (rule.lawyerId && rule.lawyerId !== event.lawyerId) return false;
  return inEffect(rule, event.occurredAt);
}

function priceEvent(rule: FeeRule, event: BillableEvent): number {
  switch (rule.feeType) {
    case "ad_spend_passthrough": {
      const spend = event.amountCents ?? 0;
      return spend + Math.round((spend * (rule.percent ?? 0)) / 100);
    }
    case "percent_of_fee":
      return Math.round(((event.amountCents ?? 0) * (rule.percent ?? 0)) / 100);
    default:
      return rule.amountCents ?? 0;
  }
}

/** Turns a period's billable events into invoice lines, skipping any rule the structure does not allow. */
export function computeCharges(
  events: BillableEvent[],
  rules: FeeRule[],
  structure: BusinessStructure,
): ChargeResult {
  const blockedRules: ChargeResult["blockedRules"] = [];
  const usable: FeeRule[] = [];
  for (const rule of rules) {
    const check = checkRule(rule, structure);
    if (check.allowed && EVENT_FOR[rule.feeType] !== null) usable.push(rule);
    else if (!check.allowed) blockedRules.push({ ruleId: rule.id, reason: check.reason });
  }

  const lines: ChargeLine[] = [];
  const perRuleTotal = new Map<string, number>();
  for (const event of events) {
    for (const rule of usable) {
      if (!matches(rule, event)) continue;
      let amount = priceEvent(rule, event);
      if (rule.capCents !== undefined) {
        const soFar = perRuleTotal.get(rule.id) ?? 0;
        amount = Math.max(0, Math.min(amount, rule.capCents - soFar));
      }
      perRuleTotal.set(rule.id, (perRuleTotal.get(rule.id) ?? 0) + amount);
      lines.push({ ruleId: rule.id, eventId: event.id, feeType: rule.feeType, amountCents: amount });
    }
  }
  return { lines, totalCents: lines.reduce((s, l) => s + l.amountCents, 0), blockedRules };
}
