import { describe, expect, it } from "vitest";
import { captureTags, heardFromTags, scoreLead, segmentTags, toolTags, type ScoreResult } from "@/lib/scoring";
import { SENSITIVE_SEGMENTS, captureFields } from "@/server/crm/adapter";
import { isGriefLead } from "@/server/nurture/scheduler";
import type { Lead } from "@/server/types";

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

  it("adds a little for calculators and capped credit for repeat visits", () => {
    const guide = scoreLead({ ...base, capture: { tool: "guide" } }).score;
    const calc = scoreLead({ ...base, capture: { tool: "cost_calculator" } }).score;
    const repeat = scoreLead({ ...base, capture: { tool: "guide" }, priorTools: ["readiness_score", "will_vs_trust"] }).score;
    expect(calc).toBeGreaterThan(guide);
    // Earlier tools add a small, capped amount (2 each, max 4), not the old +3 each.
    expect(repeat).toBe(guide + 4);
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

const served = { state: "TX", servedStates: ["TX"], smsConsent: true };
const sum = (r: ScoreResult) => r.components.reduce((n, c) => n + c.points, 0);

describe("scoring v2", () => {
  it("logs components that add up to the score", () => {
    const r = scoreLead({
      ...served,
      answers: { matterType: "new_plan", urgency: "this_month", ownsHome: "yes", assetRange: "250k_1m", existingDocuments: "will_only", children: "minors" },
      goals: "We just had a baby and want guardians named",
    });
    expect(r.components.length).toBeGreaterThan(5);
    expect(sum(r)).toBe(r.score);
    expect(r.components.every((c) => c.label && Number.isFinite(c.points))).toBe(true);
    expect(r.components.map((c) => c.key)).toContain("documents:will_only");
  });

  it("no longer floors at 50: an empty submission is grade C", () => {
    const r = scoreLead({ ...served, answers: {}, smsConsent: false });
    expect(r.score).toBeLessThan(10);
    expect(r.grade).toBe("C");
    expect(r.tier).toBe("warm");
  });

  it("weights assets, homeownership and existing documents", () => {
    const base = scoreLead({ ...served, answers: { matterType: "update_plan" } }).score;
    expect(scoreLead({ ...served, answers: { matterType: "update_plan", assetRange: "250k_1m" } }).score).toBe(base + 10);
    expect(scoreLead({ ...served, answers: { matterType: "update_plan", assetRange: "prefer_not" } }).score).toBe(base);
    expect(scoreLead({ ...served, answers: { matterType: "update_plan", ownsHome: "yes" } }).score).toBe(base + 8);
    expect(scoreLead({ ...served, answers: { matterType: "update_plan", existingDocuments: "trust" } }).score).toBe(base + 6);
  });

  it("keeps Urgent separate from the grade", () => {
    const r = scoreLead({ ...served, answers: { urgency: "health_event" } });
    expect(r.urgent).toBe(true);
    expect(r.tier).toBe("hot");
    expect(r.redFlags).toHaveLength(1);
    expect(scoreLead({ ...served, answers: { urgency: "this_month" } }).urgent).toBe(false);
  });

  it("serves a non-resident with property or a decedent estate in a served state", () => {
    const away = { state: "NY", servedStates: ["TX"], smsConsent: false, answers: { matterType: "after_death" as const } };
    expect(scoreLead(away).tier).toBe("not_a_fit");
    const property = scoreLead({ ...away, propertyStates: ["TX"] });
    expect(property.tier).not.toBe("not_a_fit");
    expect(property.components.map((c) => c.key)).toContain("served:property_elsewhere");
    const estate = scoreLead({ ...away, capture: { tool: "cost_calculator", result: { decedentState: "TX", mode: "heir" } } });
    expect(estate.tier).not.toBe("not_a_fit");
    expect(estate.components.map((c) => c.key)).toContain("served:decedent_estate");
  });

  it("not-a-fit leads keep red flags and are not urgent grade A", () => {
    const r = scoreLead({ state: "NY", servedStates: ["TX"], answers: { urgency: "recent_death" }, smsConsent: true });
    expect(r.tier).toBe("not_a_fit");
    expect(r.score).toBe(0);
    expect(r.redFlags).toHaveLength(1);
  });

  it("distribution: typical leads do not all land in the top tier", () => {
    const m = ["new_plan", "update_plan", "after_death", "elder_care", "not_sure"] as const;
    const urg = ["exploring", "exploring", "exploring", "this_month", "this_month"] as const;
    const kids = ["none", "minors", "adults", "both"] as const;
    const assets = ["under_250k", "250k_1m", "250k_1m", "1m_5m", "prefer_not"] as const;
    const docs = ["none", "will_only", "trust", "not_sure"] as const;
    const yn = ["yes", "no", "no"] as const;
    const grades = { A: 0, B: 0, C: 0 };
    let hot = 0;
    const N = 600;
    for (let i = 0; i < N; i++) {
      const r = scoreLead({
        ...served,
        smsConsent: i % 2 === 0,
        goals: i % 3 === 0 ? "Please help me understand what we need for our family" : undefined,
        answers: {
          matterType: m[i % 5],
          urgency: urg[(i * 3) % 5],
          children: kids[(i * 7) % 4],
          assetRange: assets[(i * 11) % 5],
          existingDocuments: docs[(i * 13) % 4],
          ownsHome: yn[(i * 17) % 3],
          ownsBusiness: yn[(i * 19) % 3],
          blendedFamily: yn[(i * 23) % 3],
          specialNeeds: yn[(i * 29) % 3],
          outOfStateProperty: yn[(i * 31) % 3],
        },
        capture: { tool: "plan_finder" },
      });
      grades[r.grade]++;
      if (r.tier === "hot") hot++;
    }
    expect(hot / N).toBeLessThan(0.4);
    expect(grades.A / N).toBeLessThan(0.3);
    expect(grades.A).toBeGreaterThan(0);
    expect(grades.B / N).toBeGreaterThan(0.15);
    expect(grades.C / N).toBeGreaterThan(0.2);
  });
});

describe("tool signal", () => {
  const answers = { matterType: "new_plan" as const };
  const stack = (n: number) => (["readiness_score", "cost_calculator", "will_vs_trust", "guide", "exit_offer"] as const).slice(0, n);
  const toolPoints = (r: ScoreResult) => r.components.filter((c) => c.key.startsWith("tool_signal:") && c.points > 0).reduce((n, c) => n + c.points, 0);
  const net = (r: ScoreResult) => r.components.filter((c) => c.key.startsWith("tool_signal:")).reduce((n, c) => n + c.points, 0);

  it("caps the total at +20 even with every tag and many tools", () => {
    const capture = {
      tool: "readiness_score" as const,
      result: { readinessScore: 20, gaps: "trustFunded,beneficiaries", estateValue: 14_000_000, medicaidPlanningInterest: true },
    };
    const r = scoreLead({ ...served, answers, capture, priorTools: ["cost_calculator", "will_vs_trust"] });
    expect(toolPoints(r)).toBeGreaterThan(20);
    expect(net(r)).toBe(20);
    expect(sum(r)).toBe(r.score);
    expect(r.components.map((c) => c.key)).toContain("tool_signal:cap");
  });

  it("does not inflate with tool-hopping", () => {
    const one = scoreLead({ ...served, answers, capture: { tool: "will_vs_trust" } });
    const many = scoreLead({ ...served, answers, capture: { tool: "will_vs_trust" }, priorTools: [...stack(5), ...stack(5)] });
    expect(many.score - one.score).toBeLessThanOrEqual(4);
    expect(net(many)).toBeLessThanOrEqual(20);
  });

  it("derives tags from tool results", () => {
    expect(toolTags({ tool: "readiness_score", result: { gaps: "will,trustFunded,beneficiaries" } })).toEqual(["trust_unfunded", "beneficiary_gap"]);
    expect(toolTags({ tool: "cost_calculator", result: { estateTaxStatus: "approaching" } })).toEqual(["estate_tax_watch"]);
    expect(toolTags({ tool: "cost_calculator", result: { estateValue: 300_000 } })).toEqual([]);
    expect(toolTags({ tool: "will_vs_trust", result: { medicaidPlanningInterest: true } })).toEqual(["medicaid_planning_interest"]);
  });
});

describe("heir tools and sensitive tags", () => {
  const heir = { tool: "cost_calculator" as const, result: { mode: "heir", estateValue: 400_000 } };
  const lead = (segments: string[], capture?: Lead["capture"]) => ({ segments, matterType: "new_plan", capture }) as Pick<Lead, "segments" | "matterType" | "capture">;

  it("sends heir tool leads to the grief track", () => {
    const tags = toolTags(heir);
    expect(tags).toEqual(expect.arrayContaining(["estate_administration", "heir_probate", "executor_or_heir"]));
    expect(isGriefLead(lead(tags, heir))).toBe(true);
    expect(isGriefLead(lead(["heir_probate"]))).toBe(true);
    expect(isGriefLead(lead(["executor_or_heir"]))).toBe(true);
    expect(isGriefLead(lead(["trust_unfunded"]))).toBe(false);
  });

  it("keeps sensitive tags out of CRM marketing tags", () => {
    expect(SENSITIVE_SEGMENTS).toContain("medicaid_planning_interest");
    const fields = captureFields({
      segments: ["homeowner", "estate_tax_watch", "trust_unfunded", "beneficiary_gap", "medicaid_planning_interest", "heir_probate", "executor_or_heir"],
      capture: { tool: "will_vs_trust" },
      source: {},
    } as unknown as Lead);
    expect(fields.tags).toEqual(["homeowner", "estate_tax_watch", "trust_unfunded", "beneficiary_gap"]);
    expect(fields.sensitiveTrack).toBe(true);
  });
});
