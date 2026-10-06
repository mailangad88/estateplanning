import { FIGURES } from "@/config/figures";
import type { CaptureTool } from "@/lib/lead";
import type { QuizAnswers } from "@/lib/quiz";

/** Editable weights (scoring v2, 0-100). Tune once real conversion data exists. */
export const SCORE_WEIGHTS = {
  matterFit: { new_plan: 20, update_plan: 20, after_death: 20, elder_care: 10, not_sure: 8 } satisfies Record<QuizAnswers["matterType"], number>,
  urgency: { exploring: 0, this_month: 15, health_event: 25, recent_death: 20 },
  homeowner: 8,
  /** Property in a served state while living elsewhere, or a decedent estate in a served state */
  servedPropertyElsewhere: 8,
  assets: { under_250k: 0, "250k_1m": 10, "1m_5m": 15, over_5m: 15, prefer_not: 0 } satisfies Record<QuizAnswers["assetRange"], number>,
  complexity: { minors: 6, specialNeeds: 10, blended: 6, business: 8, outOfStateProperty: 4 },
  complexityCap: 25,
  existingDocuments: { none: 0, will_only: 4, trust: 6, not_sure: 2 } satisfies Record<QuizAnswers["existingDocuments"], number>,
  goalsText: 5,
  goalsMinLength: 20,
  /** Consent to text is the one real contactability signal we have at submit time */
  smsConsent: 5,
  /** Capture points where the visitor explicitly asked to talk */
  directRequest: { intake: 10, callback: 15 } as Partial<Record<CaptureTool, number>>,
  /** Everything tools contribute, however many were used. Routing can still use tool behavior; the score cannot be inflated by it. */
  toolSignalCap: 20,
  toolCompletion: 3,
  priorToolEach: 2,
  priorToolCap: 4,
  gradeA: 70,
  gradeB: 45,
};

/** Capture points where the visitor explicitly asked to be contacted. Always tier "hot". */
const DIRECT_REQUESTS: CaptureTool[] = ["intake", "callback"];
const TOOL_CAPTURES: CaptureTool[] = ["readiness_score", "cost_calculator", "will_vs_trust", "family_plan"];

/** hot = Urgent, grade A or a direct request; warm = everything else that is served. Kept for existing consumers; prefer `grade` and `urgent`. */
export type Tier = "hot" | "warm" | "not_a_fit";
export type Grade = "A" | "B" | "C";

export interface ScoreComponent {
  /** Stable id, e.g. `urgency:this_month` or `tool_signal:readiness_score:readiness` */
  key: string;
  /** Plain-language reason shown to the attorney */
  label: string;
  points: number;
}

export interface ScoreResult {
  score: number;
  tier: Tier;
  /** A >= 70, B 45-69, C below 45 */
  grade: Grade;
  /** Any red flag. Same-day attorney review, independent of the grade */
  urgent: boolean;
  /** Every point that went into `score`; the points sum to `score` (caps appear as negative entries) */
  components: ScoreComponent[];
  redFlags: string[];
  notFitReason?: string;
}

type Result = Record<string, string | number | boolean>;
type Capture = { tool: CaptureTool; resource?: string; result?: Result };

const gradeFor = (score: number): Grade => (score >= SCORE_WEIGHTS.gradeA ? "A" : score >= SCORE_WEIGHTS.gradeB ? "B" : "C");

function strList(v: unknown): string[] {
  return typeof v === "string" ? v.split(/[,;]/).map((x) => x.trim()).filter(Boolean) : [];
}

/** Tool findings that become tags and score. Reads flat result values only; never stores the figures. */
export function toolFindings(capture?: Capture) {
  const r: Result = capture?.result ?? {};
  const gaps = strList(r.gaps);
  const value = Number(r.estateValue ?? 0);
  const funding = String(r.trustFunding ?? "");
  return {
    heir: r.mode === "heir",
    estateTaxWatch:
      r.estateTaxWatch === true ||
      ["approaching", "above", "cliff_zone", "above_cliff", "could_be_either"].includes(String(r.estateTaxStatus ?? "")) ||
      (value > 0 && value >= FIGURES.federalExemption * 0.8),
    trustUnfunded: r.trustUnfunded === true || gaps.includes("trustFunded") || ["partly", "unsure", "not_funded"].includes(funding),
    beneficiaryGap: r.beneficiaryGap === true || gaps.includes("beneficiaries"),
    medicaidInterest: r.medicaidPlanningInterest === true || r.medicaidInterest === true,
  };
}

/** Tags for what the tool revealed. `medicaid_planning_interest` is sensitive (see SENSITIVE_SEGMENTS). */
export function toolTags(capture?: Capture): string[] {
  const f = toolFindings(capture);
  const tags: string[] = [];
  if (f.estateTaxWatch) tags.push("estate_tax_watch");
  if (f.trustUnfunded) tags.push("trust_unfunded");
  if (f.beneficiaryGap) tags.push("beneficiary_gap");
  if (f.medicaidInterest) tags.push("medicaid_planning_interest");
  // Heir tools: the visitor is probably handling a death. These route to the grief track.
  if (f.heir) tags.push("estate_administration", "heir_probate", "executor_or_heir");
  return tags;
}

/** Uncapped tool components. The caller applies the +20 cap. */
function toolComponents(capture: Capture | undefined, priorTools: CaptureTool[]): ScoreComponent[] {
  const w = SCORE_WEIGHTS;
  const out: ScoreComponent[] = [];
  const tool = capture?.tool;
  const r: Result = capture?.result ?? {};
  const add = (name: string, label: string, points: number) => {
    if (points > 0) out.push({ key: `tool_signal:${tool}:${name}`, label, points });
  };
  if (tool && TOOL_CAPTURES.includes(tool)) {
    add("completion", "Finished a planning tool", w.toolCompletion);
    const f = toolFindings(capture);
    if (typeof r.readinessScore === "number") {
      add("readiness", `Readiness score ${r.readinessScore} of 100`, r.readinessScore < 65 ? 8 : r.readinessScore < 85 ? 4 : 1);
    }
    if (r.lean === "trust") add("lean", "Will-or-trust comparison leaned toward a trust", 4);
    const value = Number(r.estateValue ?? 0);
    if (f.heir) add("heir", "Used the tool for an estate they are handling", 8);
    else if (value >= 1_000_000) add("estate_value", "Estimated estate over $1M", 7);
    else if (value >= 500_000) add("estate_value", "Estimated estate over $500k", 5);
    if (f.estateTaxWatch) add("estate_tax_watch", "Estate near the estate tax threshold", 8);
    if (f.trustUnfunded) add("trust_unfunded", "Trust that may not be funded", 4);
    if (f.beneficiaryGap) add("beneficiary_gap", "Beneficiary designations need review", 3);
    if (f.medicaidInterest) add("medicaid", "Interested in long-term care planning", 6);
  }
  const earlier = new Set(priorTools.filter((t) => t !== tool && TOOL_CAPTURES.includes(t)));
  if (earlier.size > 0) {
    out.push({
      key: "tool_signal:prior_tools",
      label: `Used ${earlier.size} other tool${earlier.size === 1 ? "" : "s"} (small, counted once)`,
      points: Math.min(earlier.size * w.priorToolEach, w.priorToolCap),
    });
  }
  return out;
}

export function scoreLead(input: {
  state: string;
  servedStates: string[];
  answers: Partial<QuizAnswers>;
  goals?: string;
  smsConsent: boolean;
  capture?: Capture;
  priorTools?: CaptureTool[];
  /** States where the visitor owns property, when known (also read from tool results) */
  propertyStates?: string[];
  /** State where a decedent's estate sits, when it differs from where the visitor lives */
  decedentState?: string;
}): ScoreResult {
  const a = input.answers;
  const w = SCORE_WEIGHTS;
  const redFlags: string[] = [];
  if (a.urgency === "health_event") redFlags.push("Health event or upcoming surgery: attorney review today");
  if (a.urgency === "recent_death") redFlags.push("Recent death: possible deadlines, attorney review today");

  const r: Result = input.capture?.result ?? {};
  const propertyStates = [
    ...(input.propertyStates ?? []),
    ...[r.propertyState, r.estimateState].filter((v): v is string => typeof v === "string"),
  ];
  const decedentState = input.decedentState ?? (typeof r.decedentState === "string" ? r.decedentState : undefined);
  const resides = input.servedStates.includes(input.state);
  const servedProperty = propertyStates.find((s) => input.servedStates.includes(s));
  const servedDecedent = decedentState && input.servedStates.includes(decedentState) ? decedentState : undefined;

  if (!resides && !servedProperty && !servedDecedent) {
    return {
      score: 0,
      tier: "not_a_fit",
      grade: "C",
      urgent: false,
      components: [],
      redFlags,
      notFitReason: `State ${input.state} is not served`,
    };
  }

  const components: ScoreComponent[] = [];
  const add = (key: string, label: string, points: number) => {
    if (points !== 0) components.push({ key, label, points });
  };

  if (a.matterType) add(`matter:${a.matterType}`, `Matter type: ${a.matterType.replace(/_/g, " ")}`, w.matterFit[a.matterType]);
  if (a.urgency) add(`urgency:${a.urgency}`, `Timing: ${a.urgency.replace(/_/g, " ")}`, w.urgency[a.urgency]);
  if (!resides && servedDecedent) add("served:decedent_estate", `Estate of the person who died sits in ${servedDecedent}; visitor lives elsewhere`, w.servedPropertyElsewhere);
  else if (!resides && servedProperty) add("served:property_elsewhere", `Owns property in ${servedProperty} while living in ${input.state}`, w.servedPropertyElsewhere);

  if (a.ownsHome === "yes") add("homeowner", "Owns a home (trust-package indicator)", w.homeowner);
  // Calculator users state an estate value even when they skipped the quiz.
  const calcValue = Number(r.estateValue ?? 0);
  const assetPoints = a.assetRange ? w.assets[a.assetRange] : calcValue >= 1_000_000 ? w.assets["1m_5m"] : calcValue >= 250_000 ? w.assets["250k_1m"] : 0;
  add("assets", a.assetRange ? `Assets: ${a.assetRange.replace(/_/g, " ")}` : "Assets: estimated in a calculator", assetPoints);

  const c = w.complexity;
  const complexity: ScoreComponent[] = [];
  if (a.children === "minors" || a.children === "both") complexity.push({ key: "complexity:minors", label: "Minor children", points: c.minors });
  if (a.specialNeeds === "yes") complexity.push({ key: "complexity:special_needs", label: "Family member with special needs", points: c.specialNeeds });
  if (a.blendedFamily === "yes") complexity.push({ key: "complexity:blended", label: "Blended family", points: c.blended });
  if (a.ownsBusiness === "yes") complexity.push({ key: "complexity:business", label: "Owns a business", points: c.business });
  if (a.outOfStateProperty === "yes" && resides) complexity.push({ key: "complexity:out_of_state_property", label: "Property in another state", points: c.outOfStateProperty });
  components.push(...complexity);
  const complexityTotal = complexity.reduce((n, x) => n + x.points, 0);
  if (complexityTotal > w.complexityCap) add("complexity:cap", `Complexity capped at ${w.complexityCap}`, w.complexityCap - complexityTotal);

  if (a.existingDocuments) {
    add(`documents:${a.existingDocuments}`, `Existing documents: ${a.existingDocuments.replace(/_/g, " ")} (update propensity)`, w.existingDocuments[a.existingDocuments]);
    if (a.existingDocuments === "will_only" && a.ownsHome === "yes") add("documents:will_only_homeowner", "Will only and owns a home: strong trust candidate", 3);
  }
  if ((input.goals?.trim().length ?? 0) > w.goalsMinLength) add("goals_text", "Described their situation in their own words", w.goalsText);
  if (input.smsConsent) add("contact:sms_consent", "Agreed to text messages", w.smsConsent);

  const tool = input.capture?.tool ?? "plan_finder";
  add(`intent:${tool}`, tool === "callback" ? "Asked for a call back" : "Filled in the intake form", w.directRequest[tool] ?? 0);

  const toolParts = toolComponents(input.capture, input.priorTools ?? []);
  components.push(...toolParts);
  const toolTotal = toolParts.reduce((n, x) => n + x.points, 0);
  if (toolTotal > w.toolSignalCap) add("tool_signal:cap", `Tool signal capped at ${w.toolSignalCap}`, w.toolSignalCap - toolTotal);

  const raw = components.reduce((n, x) => n + x.points, 0);
  if (raw > 100) add("cap:100", "Score capped at 100", 100 - raw);
  const score = Math.min(raw, 100);

  const grade = gradeFor(score);
  const urgent = redFlags.length > 0;
  const tier: Tier = urgent || grade === "A" || DIRECT_REQUESTS.includes(tool) ? "hot" : "warm";
  return { score, tier, grade, urgent, components, redFlags };
}

/** Nurture segment tags derived from quiz answers. */
export function segmentTags(a: Partial<QuizAnswers>): string[] {
  const tags: string[] = [];
  if (a.children === "minors" || a.children === "both") tags.push("new_parent");
  if (a.ownsHome === "yes") tags.push("homeowner");
  if (a.blendedFamily === "yes") tags.push("blended_family");
  if (a.ownsBusiness === "yes") tags.push("business_owner");
  if (a.specialNeeds === "yes") tags.push("special_needs");
  if (a.matterType === "elder_care") tags.push("caregiver");
  if (a.maritalStatus === "widowed") tags.push("widowed");
  if (a.matterType === "after_death") tags.push("estate_administration");
  return tags;
}

/** Tag for the self-reported "How did you hear about us?" answer, e.g. `heard:ai_assistant`. */
export function heardFromTags(source: { heardFrom?: string }): string[] {
  return source.heardFrom ? [`heard:${source.heardFrom}`] : [];
}

/** Tags for the capture point, so nurture emails can follow up on what the visitor used or downloaded. */
export function captureTags(capture: { tool: CaptureTool; resource?: string }, resourceSegments: string[] = []): string[] {
  const tags = [`tool:${capture.tool}`];
  if (capture.resource) tags.push(`resource:${capture.resource}`);
  for (const s of resourceSegments) if (s !== "general") tags.push(s);
  return tags;
}
