/** Guardian picker: pure logic. A conversation aid, not a verdict. */

export const CRITERIA = ["values", "health", "location", "willing", "bond", "finances", "household"] as const;
export type Crit = (typeof CRITERIA)[number];
export type Weight = 1 | 2 | 3;
export type Rating = 1 | 2 | 3 | 4 | 5;
export type AgeBand = "under_40" | "40_54" | "55_69" | "70_plus";

export const CRITERIA_TEXT: Record<Crit, string> = {
  values: "Raises children the way I would: values, faith, discipline.",
  health: "Healthy, stable and likely to be able to raise a child for years.",
  location: "Lives close enough that my children's school, friends and routines could stay mostly the same.",
  willing: "Would take this on gladly.",
  bond: "Already close with my children.",
  finances: "Financially stable, even before any money I leave.",
  household: "Their home and family would fit my children (space, other children, partner on board).",
};

export const CRITERIA_SHORT: Record<Crit, string> = {
  values: "values and parenting style",
  health: "health and stability",
  location: "living close by",
  willing: "willingness",
  bond: "bond with the children",
  finances: "financial stability",
  household: "fit with their household",
};

export interface Candidate {
  id: string;
  label: string;
  ageBand: AgeBand;
  asked: "yes" | "no";
  ratings: Record<Crit, Rating>;
}

export type Flag = "age_70_plus" | "willingness_low" | "not_asked" | "distance" | "health_stability";

export const FLAG_NOTES: Record<Flag, string> = {
  age_70_plus:
    "A guardian needs to be able to raise a child for many years. Many parents name a younger primary guardian and an older backup, or the reverse for the short term.",
  not_asked:
    "Many parents say the hardest part was the conversation. People often ask before naming someone, since guardians can decline.",
  willingness_low: "If someone seems reluctant, that matters.",
  distance:
    "Moving children can add disruption on top of grief. Some families weigh distance heavily, others do not.",
  health_stability:
    "Health and stability can change over the years. Some parents name a backup so there is a second option.",
};

export interface Scored { id: string; score: number; flags: Flag[] }

export function defaultImportance(): Record<Crit, Weight> {
  return { values: 2, health: 2, location: 2, willing: 2, bond: 2, finances: 2, household: 2 };
}

export function candidateLabel(c: { label: string }, index: number) {
  return c.label.trim() || `Person ${index + 1}`;
}

export function validateCandidates(cands: Candidate[]): string | null {
  return cands.length === 0 ? "Add at least one person" : null;
}

export function rank(importance: Record<Crit, Weight>, cands: Candidate[]) {
  const sumW = CRITERIA.reduce((s, c) => s + importance[c], 0);
  const scored: Scored[] = cands
    .map((c) => {
      const raw = CRITERIA.reduce((s, k) => s + importance[k] * c.ratings[k], 0);
      const score = Math.round((100 * raw) / (5 * sumW));
      const flags: Flag[] = [];
      if (c.ageBand === "70_plus") flags.push("age_70_plus");
      if (c.ratings.willing <= 2) flags.push("willingness_low");
      if (c.asked === "no") flags.push("not_asked");
      if (c.ratings.location <= 2) flags.push("distance");
      if (c.ratings.health <= 2) flags.push("health_stability");
      return { id: c.id, score, flags };
    })
    .sort((a, b) => b.score - a.score);
  const close = scored.length > 1 && scored[0].score - scored[1].score <= 5;
  return { scored, close, backup: scored[1]?.id ?? null };
}

/** The two criteria where the candidates' weighted ratings differ most (needs 2+ candidates). */
export function drivers(importance: Record<Crit, Weight>, cands: Candidate[]): Crit[] {
  if (cands.length < 2) return [];
  return [...CRITERIA]
    .map((k) => {
      const vals = cands.map((c) => c.ratings[k]);
      return { k, spread: importance[k] * (Math.max(...vals) - Math.min(...vals)) };
    })
    .filter((d) => d.spread > 0)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 2)
    .map((d) => d.k);
}
