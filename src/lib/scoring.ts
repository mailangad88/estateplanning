import type { QuizAnswers } from "@/lib/quiz";

/** Editable weights. Tune once real conversion data exists. */
export const SCORE_WEIGHTS = {
  matterServed: 25,
  urgency: { exploring: 0, this_month: 15, health_event: 25, recent_death: 25 },
  complexity: 5, // per complexity factor, capped at 20
  complexityCap: 20,
  completeness: 15,
  hasGoals: 5,
  reachable: 10,
};

export type Tier = "hot" | "warm" | "not_a_fit";

export interface ScoreResult {
  score: number;
  tier: Tier;
  redFlags: string[];
  notFitReason?: string;
}

const SERVED_MATTERS: QuizAnswers["matterType"][] = ["new_plan", "update_plan", "after_death", "elder_care", "not_sure"];

export function scoreLead(input: {
  state: string;
  servedStates: string[];
  answers: Partial<QuizAnswers>;
  goals?: string;
  smsConsent: boolean;
}): ScoreResult {
  const a = input.answers;
  const redFlags: string[] = [];
  if (a.urgency === "health_event") redFlags.push("Health event or upcoming surgery: attorney review today");
  if (a.urgency === "recent_death") redFlags.push("Recent death: possible deadlines, attorney review today");

  if (!input.servedStates.includes(input.state)) {
    return { score: 0, tier: "not_a_fit", redFlags, notFitReason: `State ${input.state} is not served` };
  }

  const w = SCORE_WEIGHTS;
  let score = 0;
  if (a.matterType && SERVED_MATTERS.includes(a.matterType)) score += w.matterServed;
  if (a.urgency) score += w.urgency[a.urgency];

  const factors = [
    a.children === "minors" || a.children === "both",
    a.specialNeeds === "yes",
    a.blendedFamily === "yes",
    a.ownsHome === "yes",
    a.ownsBusiness === "yes",
    a.outOfStateProperty === "yes",
    a.assetRange === "1m_5m" || a.assetRange === "over_5m",
  ].filter(Boolean).length;
  score += Math.min(factors * w.complexity, w.complexityCap);

  const answered = Object.values(a).filter((v) => v !== undefined).length;
  score += Math.round((answered / 11) * w.completeness);
  if (input.goals && input.goals.trim().length > 0) score += w.hasGoals;
  score += w.reachable;

  const tier: Tier = score >= 60 || redFlags.length > 0 ? "hot" : "warm";
  return { score: Math.min(score, 100), tier, redFlags };
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
