import { describe, expect, it } from "vitest";
import { reviewBatches, reviewQueue } from "@/lib/review-queue";
import { willRulesCsv, willRulesTable } from "@/lib/will-rules";

describe("attorney review queue", () => {
  it("lists every unreviewed page once, highest search value first", () => {
    const q = reviewQueue();
    expect(q.length).toBeGreaterThan(100);
    expect(new Set(q.map((i) => i.path)).size).toBe(q.length);
    for (let i = 1; i < q.length; i++) expect(q[i - 1].score).toBeGreaterThanOrEqual(q[i].score);
  });

  it("puts every state guide and every cost page in the high-risk batch", () => {
    const q = reviewQueue();
    expect(q.filter((i) => i.kind === "state").every((i) => i.tier === "high")).toBe(true);
    expect(q.filter((i) => /cost/.test(i.path)).every((i) => i.tier === "high")).toBe(true);
    const b = reviewBatches();
    expect(b.counts.low + b.counts.medium + b.counts.high).toBe(b.total);
  });
});

describe("will rules by state", () => {
  it("covers all 50 states and DC with a witness rule for each", () => {
    const rows = willRulesTable();
    expect(rows).toHaveLength(51);
    expect(rows.filter((r) => r.witnesses === "See rule").map((r) => r.abbr)).toEqual([]);
    expect(willRulesCsv().trim().split("\n")).toHaveLength(52);
  });
});

describe("question bank", () => {
  it("is valid: known clusters, unique questions, coverage pointing at real pages", async () => {
    const fs = await import("node:fs");
    const { getClusters, findByUrl } = await import("@/lib/library");
    const bank = JSON.parse(fs.readFileSync("content/questions.json", "utf8")).items as { q: string; cluster: string; coverage: string; coveredBy: string | null }[];
    const clusters = new Set(getClusters().map((c) => c.slug));
    expect(bank.length).toBeGreaterThan(1000);
    expect(bank.filter((q) => !clusters.has(q.cluster)).map((q) => q.q)).toEqual([]);
    expect(new Set(bank.map((q) => q.q.toLowerCase())).size).toBe(bank.length);
    const learnRefs = bank.filter((q) => q.coveredBy?.startsWith("/learn/"));
    expect(learnRefs.filter((q) => !findByUrl(q.coveredBy!)).map((q) => q.coveredBy)).toEqual([]);
  });
});
