import { packages, type Package } from "@/config/firm";
import type { QuizAnswers } from "@/lib/quiz";

/**
 * Plan finder flow (L7). State comes first so visitors outside the firm's states learn that
 * before giving any contact details. Then six short steps chosen because scoring and the
 * education topics depend on them most. Quiz keys not asked here (relationship status,
 * existing documents) stay optional in the lead schema and are asked on /intake.
 */

export type Answers = Partial<QuizAnswers>;

/** Yes/no quiz keys gathered on one "Do any of these apply?" step. Unchecked means "no". */
export const SITUATION_IDS = ["specialNeeds", "blendedFamily", "ownsBusiness", "outOfStateProperty"] as const;
export type SituationId = (typeof SITUATION_IDS)[number];

export const SITUATION_LABELS: Record<SituationId, string> = {
  blendedFamily: "I or my spouse have children from a previous relationship",
  ownsBusiness: "I own all or part of a business",
  outOfStateProperty: "I own real estate in another state",
  specialNeeds: "Someone who depends on me has special needs or receives disability benefits",
};

export type PlanFinderStep =
  | { kind: "state"; id: "state" }
  | { kind: "single"; id: "matterType" | "children" | "ownsHome" | "assetRange" | "urgency" }
  | { kind: "situations"; id: "situations" };

const ALL_STEPS: PlanFinderStep[] = [
  { kind: "state", id: "state" },
  { kind: "single", id: "matterType" },
  { kind: "single", id: "children" },
  { kind: "single", id: "ownsHome" },
  { kind: "situations", id: "situations" },
  { kind: "single", id: "assetRange" },
  { kind: "single", id: "urgency" },
];

/** Steps for the current answers. Settling an estate skips the family and property questions. */
export function planFinderSteps(a: Answers): PlanFinderStep[] {
  if (a.matterType !== "after_death") return ALL_STEPS;
  return ALL_STEPS.filter((s) => s.id !== "children" && s.id !== "ownsHome" && s.kind !== "situations");
}

/** Keeps only answers to steps the visitor actually saw, e.g. after switching to "settling an estate". */
export function pruneAnswers(a: Answers): Answers {
  const keys = new Set<string>();
  for (const s of planFinderSteps(a)) {
    if (s.kind === "single") keys.add(s.id);
    if (s.kind === "situations") SITUATION_IDS.forEach((id) => keys.add(id));
  }
  return Object.fromEntries(Object.entries(a).filter(([k, v]) => keys.has(k) && v !== undefined)) as Answers;
}

/** Most steps the flow can show, for "about N questions" copy and tests. */
export const PLAN_FINDER_MAX_STEPS = ALL_STEPS.length;

export function isServedState(state: string | undefined, served: readonly string[]): boolean {
  return Boolean(state) && served.includes(state!.toUpperCase());
}

/**
 * The package people with similar answers commonly start from, from the firm's own list.
 * Null when the visitor is settling someone else's estate (no planning package applies).
 * This is a starting point for the consult, not a recommendation.
 */
export function likelyPackage(a: Answers, list: Package[] = packages): Package | null {
  if (a.matterType === "after_death") return null;
  const byName = (name: string) => list.find((p) => p.name === name) ?? null;
  const legacy =
    a.specialNeeds === "yes" || a.blendedFamily === "yes" || a.ownsBusiness === "yes" || a.outOfStateProperty === "yes" || a.assetRange === "over_5m";
  if (legacy) return byName("Legacy");
  const complete = a.ownsHome === "yes" || a.children === "minors" || a.children === "both" || a.assetRange === "1m_5m";
  return byName(complete ? "Complete" : "Essentials");
}
