import { describe, it, expect } from "vitest";
import { whoInherits, sumLivingShares, fracText, isSupported, frac, type Family } from "@/lib/tools/whoInherits";

const fam = (o: Partial<Family>): Family => ({ married: false, children: 0, deceasedChildren: [], parentsLiving: 0, siblings: 0, deceasedSiblings: [], ...o });
const txt = (o: Partial<Family>) => whoInherits(fam(o)).heirs.map((h) => `${h.label}:${fracText(h.share)}`);
const one = (o: Partial<Family>) => { const r = whoInherits(fam(o)); expect(fracText(sumLivingShares(r))).toBe("1"); return r; };

describe("Illinois 2-1 branches", () => {
  it("spouse and children: half and half", () => {
    const r = one({ married: true, children: 2 });
    expect(r.branch).toBe("spouse_and_descendants");
    expect(txt({ married: true, children: 2 })).toEqual(["Spouse:1/2", "Child 1:1/4", "Child 2:1/4"]);
  });
  it("spouse and a deceased child's grandchildren (per stirpes)", () => {
    const r = one({ married: true, children: 1, deceasedChildren: [2] });
    expect(r.heirs.map((h) => fracText(h.share))).toEqual(["1/2", "1/4", "1/8", "1/8"]);
    expect(r.placeholders[0].share).toEqual(frac(1, 4));
  });
  it("children only", () => {
    const r = one({ children: 3 });
    expect(r.branch).toBe("descendants_only");
    expect(r.heirs.every((h) => fracText(h.share) === "1/3")).toBe(true);
  });
  it("only grandchildren through two deceased children", () => {
    const r = one({ deceasedChildren: [1, 3] });
    expect(r.heirs.map((h) => fracText(h.share))).toEqual(["1/2", "1/6", "1/6", "1/6"]);
  });
  it("spouse only takes all, even with parents and siblings living", () => {
    const r = one({ married: true, parentsLiving: 2, siblings: 3 });
    expect(r.branch).toBe("spouse_only");
    expect(r.heirs).toHaveLength(1);
    expect(fracText(r.heirs[0].share)).toBe("1");
  });
  it("both parents and siblings share equally", () => {
    const r = one({ parentsLiving: 2, siblings: 2 });
    expect(r.branch).toBe("parents_and_siblings");
    expect(txt({ parentsLiving: 2, siblings: 2 })).toEqual(["Parent 1:1/4", "Parent 2:1/4", "Sibling 1:1/4", "Sibling 2:1/4"]);
  });
  it("one surviving parent gets a double portion", () => {
    const r = one({ parentsLiving: 1, siblings: 2 });
    expect(txt({ parentsLiving: 1, siblings: 2 })).toEqual(["Surviving parent:1/2", "Sibling 1:1/4", "Sibling 2:1/4"]);
    expect(r.branch).toBe("parents_and_siblings");
  });
  it("sibling's children take the sibling's share", () => {
    const r = one({ parentsLiving: 1, siblings: 1, deceasedSiblings: [2] });
    expect(r.heirs.map((h) => fracText(h.share))).toEqual(["2/4".replace("2/4", "1/2"), "1/4", "1/8", "1/8"]);
  });
  it("parents only", () => {
    expect(one({ parentsLiving: 2 }).branch).toBe("parents_only");
    expect(txt({ parentsLiving: 1 })).toEqual(["Surviving parent:1"]);
  });
  it("siblings only, with nieces and nephews", () => {
    const r = one({ siblings: 1, deceasedSiblings: [2] });
    expect(r.branch).toBe("siblings_only");
    expect(r.heirs.map((h) => fracText(h.share))).toEqual(["1/2", "1/4", "1/4"]);
  });
  it("nobody close: remote relatives, no numbers", () => {
    const r = whoInherits(fam({}));
    expect(r.branch).toBe("remote_relatives");
    expect(r.heirs).toEqual([]);
  });
  it("unmarried partner is not an heir; children take all", () => {
    expect(whoInherits(fam({ married: false, children: 1 })).heirs).toHaveLength(1);
  });
  it("clamps silly input", () => {
    expect(whoInherits(fam({ children: 99 })).heirs).toHaveLength(8);
    expect(whoInherits(fam({ children: -3 })).branch).toBe("remote_relatives");
  });
  it("only Illinois is supported", () => {
    expect(isSupported("il")).toBe(true);
    expect(isSupported("TX")).toBe(false);
  });
});
