import { describe, expect, it } from "vitest";
import { packages } from "@/config/firm";
import { leadSubmissionSchema } from "@/lib/lead";
import { isServedState, likelyPackage, PLAN_FINDER_MAX_STEPS, planFinderSteps, pruneAnswers } from "@/lib/planFinder";
import { educationTopics, QUESTIONS } from "@/lib/quiz";

describe("plan finder steps", () => {
  it("asks for the state first and keeps the flow to about seven steps", () => {
    const steps = planFinderSteps({});
    expect(steps[0].id).toBe("state");
    expect(steps.length).toBe(PLAN_FINDER_MAX_STEPS);
    expect(PLAN_FINDER_MAX_STEPS).toBeLessThanOrEqual(7);
  });

  it("only uses quiz keys that exist, so answers still fit the lead schema", () => {
    const ids = QUESTIONS.map((q) => q.id as string);
    for (const s of planFinderSteps({})) if (s.kind === "single") expect(ids).toContain(s.id);
  });

  it("skips family and property questions when settling an estate", () => {
    const ids = planFinderSteps({ matterType: "after_death" }).map((s) => s.id);
    expect(ids).toEqual(["state", "matterType", "assetRange", "urgency"]);
  });

  it("drops answers to steps the visitor no longer sees", () => {
    expect(pruneAnswers({ matterType: "after_death", children: "minors", specialNeeds: "yes", urgency: "recent_death" })).toEqual({
      matterType: "after_death",
      urgency: "recent_death",
    });
  });

  it("produces answers the lead schema accepts", () => {
    const answers = {
      matterType: "new_plan", children: "minors", ownsHome: "yes", specialNeeds: "no", blendedFamily: "yes",
      ownsBusiness: "no", outOfStateProperty: "no", assetRange: "250k_1m", urgency: "exploring",
    };
    const r = leadSubmissionSchema.safeParse({
      firstName: "Ana", email: "ana@example.com", phone: "5125550100", state: "TX", answers,
      capture: { tool: "plan_finder" }, smsConsent: false, acknowledgedNoRelationship: true,
    });
    expect(r.success).toBe(true);
  });
});

describe("isServedState", () => {
  it("matches only states the firm serves", () => {
    expect(isServedState("TX", ["TX", "CA"])).toBe(true);
    expect(isServedState("NY", ["TX", "CA"])).toBe(false);
    expect(isServedState(undefined, ["TX"])).toBe(false);
  });
});

describe("likelyPackage", () => {
  it("names a package from the firm's own list", () => {
    expect(packages.map((p) => p.name)).toContain(likelyPackage({ matterType: "new_plan" })?.name);
  });

  it("follows the package descriptions", () => {
    expect(likelyPackage({ matterType: "new_plan", children: "none", ownsHome: "no", assetRange: "under_250k" })?.name).toBe("Essentials");
    expect(likelyPackage({ matterType: "new_plan", children: "minors", ownsHome: "no" })?.name).toBe("Complete");
    expect(likelyPackage({ matterType: "update_plan", ownsHome: "yes" })?.name).toBe("Complete");
    expect(likelyPackage({ matterType: "new_plan", ownsHome: "yes", blendedFamily: "yes" })?.name).toBe("Legacy");
    expect(likelyPackage({ matterType: "new_plan", outOfStateProperty: "yes" })?.name).toBe("Legacy");
  });

  it("suggests no planning package when settling someone else's estate", () => {
    expect(likelyPackage({ matterType: "after_death" })).toBeNull();
    expect(educationTopics({ matterType: "after_death" })[0].title).toMatch(/Probate/);
  });
});
