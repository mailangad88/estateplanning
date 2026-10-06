import { describe, expect, it } from "vitest";
import { compareIllinoisAffidavit, sortAsset, sortAssets, type AssetInput } from "../src/lib/tools/assetSorter";

const A = (p: Partial<AssetInput> & Pick<AssetInput, "kind" | "holding">): AssetInput => ({ id: p.kind + p.holding, value: 10_000, ...p });
const today = new Date("2026-10-06T00:00:00Z");

describe("sortAsset", () => {
  it("sole name goes through probate", () => {
    expect(sortAsset(A({ kind: "house", holding: "sole" })).bucket).toBe("probate");
    expect(sortAsset(A({ kind: "belongings", holding: "sole" })).bucket).toBe("probate");
  });
  it("joint, trust, TOD deed and entirety skip probate", () => {
    for (const holding of ["jtwros", "trust", "tod_deed", "tbe"] as const) {
      expect(sortAsset(A({ kind: "house", holding })).bucket).toBe("outside");
    }
  });
  it("living beneficiary skips probate", () => {
    expect(sortAsset(A({ kind: "retirement", holding: "beneficiary" })).bucket).toBe("outside");
  });
  it("estate, dead or unsure beneficiary goes to probate with a flag", () => {
    const e = sortAsset(A({ kind: "life_insurance", holding: "beneficiary", beneficiary: "estate" }));
    const d = sortAsset(A({ kind: "life_insurance", holding: "beneficiary", beneficiary: "deceased" }));
    const u = sortAsset(A({ kind: "checking", holding: "beneficiary", beneficiary: "unsure" }));
    expect([e.bucket, d.bucket, u.bucket]).toEqual(["probate", "probate", "probate"]);
    expect(e.flags).toContain("estate_beneficiary");
    expect(d.flags).toContain("dead_beneficiary");
    expect(u.flags).toContain("unsure_beneficiary");
  });
  it("convenience joint account is flagged but skips probate", () => {
    const s = sortAsset(A({ kind: "checking", holding: "jtwros", jointPurpose: "convenience" }));
    expect(s.bucket).toBe("outside");
    expect(s.flags).toContain("convenience_joint");
  });
  it("no beneficiary on file for a 401k is probate", () => {
    expect(sortAsset(A({ kind: "retirement", holding: "sole" })).bucket).toBe("probate");
  });
});

describe("sortAssets", () => {
  it("totals and shares", () => {
    const r = sortAssets([
      A({ kind: "house", holding: "trust", value: 300_000 }),
      A({ kind: "checking", holding: "sole", value: 100_000 }),
    ]);
    expect(r.probateTotal).toBe(100_000);
    expect(r.outsideTotal).toBe(300_000);
    expect(r.probateShare).toBe(25);
    expect(r.outsideShare).toBe(75);
  });
  it("handles an empty list and zero values", () => {
    const r = sortAssets([A({ kind: "checking", holding: "sole", value: 0 })]);
    expect(r.total).toBe(0);
    expect(r.probateShare).toBe(0);
    expect(sortAssets([]).probate).toEqual([]);
  });
  it("collects traps once with asset ids", () => {
    const r = sortAssets([
      A({ id: "a", kind: "life_insurance", holding: "beneficiary", beneficiary: "estate" }),
      A({ id: "b", kind: "retirement", holding: "beneficiary", beneficiary: "estate" }),
    ]);
    expect(r.traps).toEqual([{ code: "estate_beneficiary", assetIds: ["a", "b"] }]);
  });
});

describe("compareIllinoisAffidavit", () => {
  it("returns null outside Illinois", () => {
    expect(compareIllinoisAffidavit(sortAssets([]), "TX", today)).toBeNull();
  });
  it("under the cap: vehicles and real estate are left out of the count", () => {
    const r = sortAssets([
      A({ kind: "checking", holding: "sole", value: 60_000 }),
      A({ kind: "vehicle", holding: "sole", value: 40_000 }),
    ]);
    const c = compareIllinoisAffidavit(r, "IL", today)!;
    expect(c.cap).toBe(150_000);
    expect(c.counted).toBe(60_000);
    expect(c.vehiclesLeftOut).toBe(40_000);
    expect(c.verdict).toBe("under_cap");
  });
  it("over the cap", () => {
    const r = sortAssets([A({ kind: "brokerage", holding: "sole", value: 200_000 })]);
    expect(compareIllinoisAffidavit(r, "IL", today)!.verdict).toBe("over_cap");
  });
  it("real estate in probate needs another route", () => {
    const r = sortAssets([A({ kind: "house", holding: "sole", value: 300_000 }), A({ kind: "checking", holding: "sole", value: 5_000 })]);
    const c = compareIllinoisAffidavit(r, "IL", today)!;
    expect(c.counted).toBe(5_000);
    expect(c.verdict).toBe("real_estate_needs_other_route");
  });
  it("nothing in probate", () => {
    const r = sortAssets([A({ kind: "house", holding: "trust" })]);
    expect(compareIllinoisAffidavit(r, "IL", today)!.verdict).toBe("nothing_in_probate");
  });
  it("hides the number when the fact is stale", () => {
    const c = compareIllinoisAffidavit(sortAssets([A({ kind: "checking", holding: "sole" })]), "IL", new Date("2028-01-01T00:00:00Z"))!;
    expect(c.cap).toBeNull();
    expect(c.verdict).toBe("number_hidden");
  });
});
