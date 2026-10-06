import { describe, expect, it } from "vitest";
import { scoreLead, segmentTags } from "@/lib/scoring";

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
