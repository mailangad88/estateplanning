import type { DecisionGuide, DecisionOption } from "@/config/decisions/types";

/** Picker answers: question id to the chosen choice ids (one for single-answer questions). */
export type DecisionAnswers = Record<string, string[]>;

export interface RankedOption {
  option: DecisionOption;
  score: number;
  /** 0 to 100, relative to the top score. */
  pct: number;
  reasons: string[];
}

export interface DecisionResult {
  top: RankedOption;
  /** Other options worth discussing: at least half the top score, at most two. */
  also: RankedOption[];
  ranked: RankedOption[];
}

/** Adds up each answer's points per option and keeps the reasons behind the strongest points. */
export function scoreDecision(guide: DecisionGuide, answers: DecisionAnswers): DecisionResult {
  const score = new Map<string, number>(guide.options.map((o) => [o.id, 0]));
  const reasons = new Map<string, string[]>(guide.options.map((o) => [o.id, []]));
  for (const q of guide.questions) {
    for (const id of answers[q.id] ?? []) {
      const choice = q.choices.find((c) => c.id === id);
      if (!choice) continue;
      for (const [opt, pts] of Object.entries(choice.weights)) {
        if (!score.has(opt)) continue;
        score.set(opt, score.get(opt)! + pts);
        if (pts >= 2) reasons.get(opt)!.push(choice.reason ?? choice.label);
      }
    }
  }
  // Ties keep the guide's order, which lists the most common choice first.
  const ranked = guide.options
    .map((option, i) => ({ option, i, score: score.get(option.id)!, reasons: [...new Set(reasons.get(option.id))] }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const max = Math.max(ranked[0].score, 1);
  const out: RankedOption[] = ranked.map(({ option, score: s, reasons: r }) => ({ option, score: s, reasons: r, pct: Math.max(0, Math.round((s / max) * 100)) }));
  const [top, ...rest] = out;
  return { top, also: rest.filter((r) => r.score > 0 && r.score >= top.score / 2).slice(0, 2), ranked: out };
}

/** True when every question has an answer. */
export function isComplete(guide: DecisionGuide, answers: DecisionAnswers): boolean {
  return guide.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);
}
