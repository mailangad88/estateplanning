import { describe, expect, it } from "vitest";
import { EXPERIMENTS, assign, hash } from "@/lib/experiments";

describe("experiments", () => {
  it("assigns the same visitor the same variant every time", () => {
    expect(assign("magnet_cta", "abc")).toBe(assign("magnet_cta", "abc"));
  });

  it("splits traffic roughly evenly", () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const v = assign("magnet_fields", `visitor-${i}`);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    for (const v of EXPERIMENTS.magnet_fields) expect(counts[v]).toBeGreaterThan(1700);
  });

  it("assigns experiments independently", () => {
    let same = 0;
    for (let i = 0; i < 2000; i++) if ((hash(`a:${i}`) % 2) === (hash(`b:${i}`) % 2)) same++;
    expect(same).toBeGreaterThan(800);
    expect(same).toBeLessThan(1200);
  });
});
