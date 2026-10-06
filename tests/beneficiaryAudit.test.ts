import { describe, it, expect } from "vitest";
import { audit, isCommunityProperty, type Entry, type Globals } from "@/lib/tools/beneficiaryAudit";

const g = (o: Partial<Globals> = {}): Globals => ({ marital: "single", events: ["none"], cp: false, ...o });
const e = (primary: Entry["primary"], contingent: Entry["contingent"] = "yes", lastReview: Entry["lastReview"] = "lt3"): Entry => ({ primary, contingent, lastReview });
const codes = (r: ReturnType<typeof audit>, k: string) => r!.per.find((p) => p.kind === k)!.flags.map((f) => f.code);

describe("beneficiary audit", () => {
  it("1 clean married 401k", () => {
    const r = audit({ plan_401k: e("spouse") }, g({ marital: "married" }))!;
    expect(r.overall).toBe(100);
    expect(r.band).toBe("looks_current");
    expect(r.per[0].flags).toHaveLength(0);
  });
  it("2 divorced ex-spouse IRA", () => {
    const r = audit({ ira: e("ex_spouse", "no", "gt5") }, g({ marital: "divorced", events: ["divorce"] }))!;
    expect(r.per[0].flags.reduce((s, f) => s + f.points, 0)).toBe(85);
    expect(r.overall).toBe(15);
    expect(r.band).toBe("fix_soon");
    expect(r.hasHigh).toBe(true);
  });
  it("3 minor child on life insurance", () => {
    const r = audit({ life: e("minor_child", "unsure", "3_5") }, g({ marital: "married" }))!;
    expect(r.overall).toBe(55);
    expect(r.band).toBe("several_risks");
  });
  it("4 high flag blocks top band", () => {
    const r = audit({ plan_401k: e("adult_children"), roth: e("spouse", "yes", "3_5") }, g({ marital: "married" }))!;
    expect(codes(r, "plan_401k")).toEqual(["spousal_consent", "ten_year_rule"]);
    expect(r.overall).toBe(85);
    expect(r.band).toBe("few_things");
  });
  it("4b waiver removes spousal consent flag", () => {
    const r = audit({ plan_401k: { ...e("adult_children"), waiver: true } }, g({ marital: "married" }))!;
    expect(codes(r, "plan_401k")).not.toContain("spousal_consent");
  });
  it("5 special needs direct", () => {
    const r = audit({ ira: e("special_needs") }, g())!;
    expect(r.overall).toBe(60);
    expect(r.band).toBe("several_risks");
  });
  it("6 estate on POD account", () => {
    const r = audit({ bank_pod: e("estate", "no") }, g())!;
    expect(r.overall).toBe(90);
    expect(r.band).toBe("looks_current");
  });
  it("7 hsa non-spouse no contingent", () => {
    const r = audit({ hsa: e("adult_children", "no") }, g())!;
    expect(r.overall).toBe(70);
    expect(r.band).toBe("few_things");
  });
  it("8 community property", () => {
    expect(isCommunityProperty("ca")).toBe(true);
    expect(isCommunityProperty("NY")).toBe(false);
    const r = audit({ ira: e("other_adult") }, g({ marital: "married", cp: true }))!;
    expect(r.overall).toBe(90);
    expect(r.band).toBe("looks_current");
  });
  it("9 averaging and worst", () => {
    const r = audit({ ira: e("ex_spouse", "no", "gt5"), life: e("spouse") }, g({ marital: "married", events: ["divorce"] }))!;
    // ira: 50+15+15+5=85 -> 15 ; life: event 5 -> 95; use no events variant below
    expect(r.worst.kind).toBe("ira");
    const r2 = audit({ ira: e("ex_spouse", "no", "gt5"), life: e("spouse") }, g({ events: ["none"] }))!;
    expect(r2.per.find((p) => p.kind === "ira")!.score).toBe(20);
    expect(r2.overall).toBe(60);
  });
  it("9b rounding 15 and 100", () => {
    const r = audit({ ira: e("ex_spouse", "no", "gt5"), life: e("spouse") }, g({ marital: "divorced", events: ["divorce"] }))!;
    expect(r.per.find((p) => p.kind === "ira")!.score).toBe(15);
  });
  it("10 no accounts", () => {
    expect(audit({}, g())).toBeNull();
  });
  it("divorced with spouse listed adds a note; charity note on IRA", () => {
    const r = audit({ ira: e("spouse"), roth: e("charity") }, g({ marital: "divorced" }))!;
    expect(r.per[0].notes[0]).toMatch(/former spouse/);
    expect(r.per[1].notes[0]).toMatch(/charity/);
    expect(r.per[1].flags).toHaveLength(0);
  });
  it("score never below zero", () => {
    const r = audit({ ira: e("ex_spouse", "no", "never") }, g({ marital: "divorced", events: ["divorce", "marriage", "death", "birth_adoption"] }))!;
    expect(r.per[0].score).toBeGreaterThanOrEqual(0);
  });
});
