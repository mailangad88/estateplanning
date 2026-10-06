import { describe, expect, it } from "vitest";
import { subsetGuide } from "@/components/decision/DecisionEmbed";
import { TYPES_OF_TRUSTS } from "@/config/decisions/trusts";
import { scoreDecision } from "@/lib/decision";

describe("subsetGuide", () => {
  const sub = subsetGuide(TYPES_OF_TRUSTS, ["revocable", "medicaid"]);

  it("keeps only the chosen options and their families", () => {
    expect(sub.options.map((o) => o.id)).toEqual(["revocable", "medicaid"]);
    for (const f of sub.families) expect(sub.options.some((o) => o.family === f.id)).toBe(true);
  });

  it("drops weights and shortcuts for removed options", () => {
    for (const q of sub.questions) for (const c of q.choices) for (const k of Object.keys(c.weights)) expect(["revocable", "medicaid"]).toContain(k);
    for (const s of sub.shortcuts) expect(["revocable", "medicaid"]).toContain(s.pick);
  });

  it("still scores to one of the kept options", () => {
    const answers = Object.fromEntries(sub.questions.map((q) => [q.id, [q.choices[0].id]]));
    expect(["revocable", "medicaid"]).toContain(scoreDecision(sub, answers).top.option.id);
  });
});
