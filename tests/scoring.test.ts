import { describe, expect, it } from "vitest";
import { captureTags, heardFromTags, scoreLead, segmentTags } from "@/lib/scoring";

describe("heardFromTags", () => {
  it("tags the self-reported source and adds nothing when skipped", () => {
    expect(heardFromTags({ heardFrom: "ai_assistant" })).toEqual(["heard:ai_assistant"]);
    expect(heardFromTags({})).toEqual([]);
  });
});

describe("scoreLead", () => {
  it("marks out-of-state leads as not a fit", () => {
    const r = scoreLead({ state: "CA", servedStates: ["TX"], answers: { matterType: "new_plan" }, smsConsent: true });
    expect(r.tier).toBe("not_a_fit");
  });

  it("makes urgent situations hot with a red flag", () => {
    const r = scoreLead({ state: "TX", servedStates: ["TX"], answers: { urgency: "recent_death" }, smsConsent: false });
    expect(r.tier).toBe("hot");
    expect(r.redFlags).toHaveLength(1);
  });

  it("keeps an exploring, simple lead warm", () => {
    const r = scoreLead({
      state: "TX",
      servedStates: ["TX"],
      answers: { matterType: "new_plan", urgency: "exploring", children: "none" },
      smsConsent: true,
    });
    expect(r.tier).toBe("warm");
  });
});

describe("segmentTags", () => {
  it("tags parents of minors and homeowners", () => {
    expect(segmentTags({ children: "minors", ownsHome: "yes" })).toEqual(["new_parent", "homeowner"]);
  });
});

describe("capture tools", () => {
  const base = { state: "TX", servedStates: ["TX"], answers: {}, smsConsent: false };

  it("makes a callback request hot", () => {
    expect(scoreLead({ ...base, capture: { tool: "callback" } }).tier).toBe("hot");
  });

  it("adds intent for calculators and repeat visits", () => {
    const guide = scoreLead({ ...base, capture: { tool: "guide" } }).score;
    const calc = scoreLead({ ...base, capture: { tool: "cost_calculator" } }).score;
    const repeat = scoreLead({ ...base, capture: { tool: "guide" }, priorTools: ["readiness_score", "will_vs_trust"] }).score;
    expect(calc).toBeGreaterThan(guide);
    expect(repeat).toBe(guide + 6);
  });

  it("counts a calculator estate value as complexity", () => {
    const small = scoreLead({ ...base, capture: { tool: "cost_calculator", result: { estateValue: 300_000 } } }).score;
    const large = scoreLead({ ...base, capture: { tool: "cost_calculator", result: { estateValue: 2_000_000 } } }).score;
    expect(large).toBeGreaterThan(small);
  });

  it("tags the tool and resource", () => {
    expect(captureTags({ tool: "guide", resource: "new-parents-guide" }, ["new_parent", "general"])).toEqual([
      "tool:guide",
      "resource:new-parents-guide",
      "new_parent",
    ]);
  });
});
