import { describe, expect, it } from "vitest";
import { LIFE_STAGES } from "@/config/life-stages";
import { PLAN_DOCS, WHAT_IF_SCENARIOS, scenariosForStage } from "@/config/what-if-scenarios";
import { learnHrefFor, lifeBoard, serviceBoardFor, stageBoard } from "@/config/life-game";

const BANNED = /\b(expert|specialist|guarantee|top-rated|number one|free (will|trust|consultation))\b|#1|best (lawyer|attorney|firm)/i;

describe("what-if scenarios", () => {
  it("have unique ids, real documents and draft status", () => {
    const ids = WHAT_IF_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of WHAT_IF_SCENARIOS) {
      expect(s.fix.length).toBeGreaterThan(0);
      for (const d of s.fix) expect(PLAN_DOCS[d]).toBeDefined();
      expect(s.reviewed).toBe(false);
    }
  });

  it("only tag life stages that exist", () => {
    const slugs = new Set(LIFE_STAGES.map((s) => s.slug));
    for (const s of WHAT_IF_SCENARIOS) for (const st of s.stages) expect(slugs.has(st)).toBe(true);
  });

  it("stay within the advertising word rules", () => {
    for (const s of WHAT_IF_SCENARIOS) expect(`${s.title} ${s.delay} ${s.without} ${s.withPlan}`).not.toMatch(BANNED);
  });

  it("give every stage several scenarios", () => {
    for (const st of LIFE_STAGES) expect(scenariosForStage(st.slug).length).toBeGreaterThanOrEqual(4);
  });
});

describe("life game boards", () => {
  it("build for every life stage, start to finish, with what-if squares", () => {
    for (const st of LIFE_STAGES) {
      const b = stageBoard(st.slug);
      expect(b).not.toBeNull();
      expect(b![0].kind).toBe("start");
      expect(b![b!.length - 1].kind).toBe("finish");
      expect(b!.filter((s) => s.kind === "whatif").length).toBeGreaterThanOrEqual(3);
    }
  });

  it("build the homepage board with one stop per stage", () => {
    const b = lifeBoard();
    expect(b.filter((s) => s.kind === "whatif")).toHaveLength(LIFE_STAGES.length);
  });

  it("build the service page boards", () => {
    for (const p of ["/wills", "/living-trusts", "/power-of-attorney", "/healthcare-directives", "/estate-planning-for-parents"]) {
      expect(serviceBoardFor(p)).not.toBeNull();
    }
    expect(serviceBoardFor("/probate")).toBeNull();
  });
});

describe("learn links", () => {
  it("appear only for pages that exist", () => {
    expect(learnHrefFor("/learn/wills/dying-without-a-will")).toBe("/learn/wills/dying-without-a-will");
    expect(learnHrefFor("/learn/what-if/not-written-yet")).toBeUndefined();
    expect(learnHrefFor(undefined)).toBeUndefined();
  });

  it("use the SEO pipeline's slugs as scenario ids", () => {
    for (const s of WHAT_IF_SCENARIOS) if (s.learn?.startsWith("/learn/what-if/")) expect(s.learn).toBe(`/learn/what-if/${s.id}`);
  });
});
