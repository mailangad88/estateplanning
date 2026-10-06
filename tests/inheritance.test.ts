import { describe, expect, it } from "vitest";
import { splitEstate } from "@/lib/inheritance";

const round = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)]));

describe("splitEstate", () => {
  it("per stirpes gives Ben's share to his two children", () => {
    expect(round(splitEstate(300000, "stirpes", new Set(["ben"])))).toEqual({ ann: 100000, dev: 50000, eli: 50000, cara: 100000 });
  });
  it("per capita splits among the living children only", () => {
    expect(round(splitEstate(300000, "capita", new Set(["ben"])))).toEqual({ ann: 150000, cara: 150000 });
  });
  it("per capita at each generation pools the shares of children who died first", () => {
    expect(round(splitEstate(300000, "generation", new Set(["ben", "cara"])))).toEqual({ ann: 100000, dev: 66667, eli: 66667, fay: 66667 });
    expect(round(splitEstate(300000, "stirpes", new Set(["ben", "cara"])))).toEqual({ ann: 100000, dev: 50000, eli: 50000, fay: 100000 });
  });
  it("always hands out the whole estate", () => {
    for (const m of ["stirpes", "capita", "generation"] as const)
      for (const d of [[], ["ben"], ["cara"], ["ben", "cara"]]) {
        const sum = Object.values(splitEstate(300000, m, new Set(d))).reduce((a, b) => a + b, 0);
        expect(Math.round(sum)).toBe(300000);
      }
  });
});
