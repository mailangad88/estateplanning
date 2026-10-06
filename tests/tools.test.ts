import { describe, expect, it } from "vitest";
import { GUIDES, findGuide } from "@/content/guides";
import { caStatutoryFee, estimateProbate } from "@/lib/tools/costEstimate";
import { READINESS_ITEMS, scoreReadiness } from "@/lib/tools/readiness";
import { weighWillVsTrust } from "@/lib/tools/willVsTrust";

describe("caStatutoryFee", () => {
  it("follows Probate Code 10810 tiers", () => {
    expect(caStatutoryFee(100_000)).toBe(4_000);
    expect(caStatutoryFee(500_000)).toBe(13_000);
    expect(caStatutoryFee(1_000_000)).toBe(23_000);
    expect(caStatutoryFee(2_000_000)).toBe(33_000);
    expect(caStatutoryFee(5_000_000)).toBe(63_000);
    expect(caStatutoryFee(25_000_000)).toBe(188_000);
  });
});

describe("estimateProbate", () => {
  it("uses the statutory schedule in California", () => {
    const e = estimateProbate({ estateValue: 1_000_000, state: "CA", otherStatesWithProperty: 0 });
    expect(e.method).toBe("ca_statutory");
    expect(e.probateCost.low).toBeGreaterThanOrEqual(23_000);
    expect(e.probateCost.high).toBeGreaterThanOrEqual(46_000);
  });

  it("uses the general range elsewhere and adds ancillary probate", () => {
    const base = estimateProbate({ estateValue: 500_000, state: "TX", otherStatesWithProperty: 0 });
    const multi = estimateProbate({ estateValue: 500_000, state: "TX", otherStatesWithProperty: 2 });
    expect(base.method).toBe("general_range");
    expect(base.probateCost).toEqual({ low: 15_000, high: 35_000 });
    expect(multi.probateCost.low).toBeGreaterThan(base.probateCost.low);
    expect(multi.notes.some((n) => n.includes("ancillary"))).toBe(true);
  });

  it("flags state estate tax only above the threshold", () => {
    expect(estimateProbate({ estateValue: 3_000_000, state: "MA", otherStatesWithProperty: 0 }).notes.join(" ")).toContain("estate tax");
    expect(estimateProbate({ estateValue: 1_500_000, state: "MA", otherStatesWithProperty: 0 }).notes.join(" ")).not.toContain("estate tax");
  });
});

describe("scoreReadiness", () => {
  it("scores 100 when everything is in place", () => {
    const all = Object.fromEntries(READINESS_ITEMS.map((i) => [i.id, "yes" as const]));
    expect(scoreReadiness(all)).toMatchObject({ score: 100, band: "well_organized", gaps: [] });
  });

  it("drops items that do not apply from the total", () => {
    const answers = Object.fromEntries(READINESS_ITEMS.map((i) => [i.id, "yes" as const])) as Record<string, "yes" | "not_applicable">;
    answers.guardian = "not_applicable";
    expect(scoreReadiness(answers).score).toBe(100);
  });

  it("lists the biggest gaps first", () => {
    const r = scoreReadiness({ will: "no", digitalAssets: "not_sure" });
    expect(r.band).toBe("getting_started");
    expect(r.gaps[0].id).toBe("will");
    expect(r.gaps.find((g) => g.id === "digitalAssets")?.unsure).toBe(true);
  });
});

describe("weighWillVsTrust", () => {
  it("leans toward a trust with multi-state property and privacy", () => {
    expect(weighWillVsTrust({ ownsHome: "yes", multiState: "yes", privacy: "yes" }).lean).toBe("trust");
  });

  it("leans toward a will for a simple, budget-first estate", () => {
    expect(weighWillVsTrust({ simpleEstate: "yes", budgetFirst: "yes", youngNoHome: "yes" }).lean).toBe("will");
  });

  it("says either when answers are balanced", () => {
    expect(weighWillVsTrust({ ownsHome: "yes", budgetFirst: "yes" }).lean).toBe("either");
  });
});

describe("guides", () => {
  it("have unique slugs and an attorney questions section", () => {
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    for (const g of GUIDES) expect(g.sections.at(-1)?.heading).toMatch(/attorney/i);
    expect(findGuide("estate-planning-checklist")).toBeDefined();
  });
});
