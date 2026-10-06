import { describe, it, expect } from "vitest";
import { smallEstate, validateDeathDate, factUsable, getRule, courtSearchUrl, SMALL_ESTATE_RULES, type SmallEstateAnswers } from "@/lib/tools/smallEstate";

const TODAY = new Date("2026-10-06T00:00:00Z");
const base = (o: Partial<SmallEstateAnswers>): SmallEstateAnswers => ({
  state: "CA", deathDate: "2025-06-01", hasWill: "no", personalValue: 0, realProperty: "none", probateOpen: "no", ...o,
});
const run = (o: Partial<SmallEstateAnswers>) => smallEstate(base(o), TODAY);

describe("smallEstate spec cases", () => {
  it("1 CA affidavit with 40 day wait", () => {
    const r = run({ personalValue: 150_000 });
    expect(r.verdict).toBe("likely_affidavit");
    expect(r.cap).toBe(208_850);
    expect(r.waitUntil).toBe("2025-07-11");
  });
  it("2 CA over cap", () => {
    const r = run({ personalValue: 220_000 });
    expect(r.verdict).toBe("likely_formal_probate");
    expect(r.reasonCode).toBe("over_cap");
  });
  it("3 CA with real property", () => {
    expect(run({ personalValue: 100_000, realProperty: "yes", realPropertyValue: 400_000 }).verdict).toBe("partial_real_property_needs_other_route");
  });
  it("4 CA earlier tier", () => {
    const r = run({ deathDate: "2023-02-01", personalValue: 190_000 });
    expect(r.cap).toBe(184_500);
    expect(r.verdict).toBe("likely_formal_probate");
  });
  it("5 TX will leads to muniment text, not the affidavit", () => {
    const r = run({ state: "TX", hasWill: "yes", personalValue: 40_000 });
    expect(r.verdict).toBe("likely_court_simplified");
    expect(r.muniment).toBe(true);
  });
  it("6 TX no will", () => {
    const r = run({ state: "TX", personalValue: 60_000 });
    expect(r.verdict).toBe("likely_court_simplified");
    expect(r.courtRequired).toBe(true);
    expect(r.waitUntil).toBe("2025-07-01");
  });
  it("7 NY", () => {
    const r = run({ state: "NY", personalValue: 40_000 });
    expect(r.verdict).toBe("likely_court_simplified");
    expect(r.waitUntil).toBeNull();
  });
  it("8 NY with real property", () => {
    expect(run({ state: "NY", personalValue: 40_000, realProperty: "yes", realPropertyValue: 300_000 }).verdict).toBe("partial_real_property_needs_other_route");
  });
  it("9 PA counts personal only", () => {
    const r = run({ state: "PA", personalValue: 45_000, realProperty: "yes", realPropertyValue: 200_000 });
    expect(r.verdict).toBe("partial_real_property_needs_other_route");
    expect(r.counted).toBe(45_000);
  });
  it("10 IL vehicles excluded", () => {
    const r = run({ state: "IL", deathDate: "2025-09-01", personalValue: 140_000, vehiclesValue: 20_000 });
    expect(r.counted).toBe(120_000);
    expect(r.verdict).toBe("likely_affidavit");
  });
  it("11 IL earlier cap", () => {
    const r = run({ state: "IL", deathDate: "2025-07-01", personalValue: 120_000 });
    expect(r.cap).toBe(100_000);
    expect(r.verdict).toBe("likely_formal_probate");
  });
  it("12 OH no spouse", () => {
    const r = run({ state: "OH", personalValue: 90_000 });
    expect(r.cap).toBe(35_000);
    expect(r.verdict).toBe("likely_formal_probate");
  });
  it("13 OH spouse takes all", () => {
    const r = run({ state: "OH", personalValue: 90_000, spouse: "yes", spouseSoleHeir: "yes" });
    expect(r.cap).toBe(100_000);
    expect(r.verdict).toBe("likely_court_simplified");
  });
  it("14 NC spouse rule", () => {
    expect(run({ state: "NC", personalValue: 25_000, spouse: "yes", spouseSoleHeir: "yes" }).verdict).toBe("likely_affidavit");
    const r = run({ state: "NC", personalValue: 25_000, spouse: "yes", spouseSoleHeir: "no" });
    expect(r.verdict).toBe("likely_formal_probate");
    expect(r.cap).toBe(20_000);
    expect(r.waitUntil).toBe("2025-07-01");
  });
  it("15 GA", () => {
    expect(run({ state: "GA" }).verdict).toBe("no_dollar_route_try_petition");
  });
  it("16 MI 2026", () => {
    const r = run({ state: "MI", deathDate: "2026-03-01", personalValue: 50_000 });
    expect(r.verdict).toBe("likely_affidavit");
    expect(r.cap).toBe(53_000);
    expect(r.waitUntil).toBe("2026-03-29");
  });
  it("17 FL dead more than 2 years has no dollar cap", () => {
    const r = run({ state: "FL", deathDate: "2022-01-01", personalValue: 400_000 });
    expect(r.verdict).toBe("likely_court_simplified");
    expect(r.cap).toBeNull();
  });
  it("18 probate already open", () => {
    expect(run({ state: "CA", probateOpen: "yes", personalValue: 1 }).verdict).toBe("needs_attorney");
  });
});

describe("smallEstate edge cases", () => {
  it("CA death before 2022-04-01 needs an attorney", () => {
    const r = run({ deathDate: "2021-12-01", personalValue: 10_000 });
    expect(r.verdict).toBe("needs_attorney");
    expect(r.reasonCode).toBe("date_outside_data");
  });
  it("MI death outside 2026 needs an attorney", () => {
    expect(run({ state: "MI", deathDate: "2025-03-01", personalValue: 10_000 }).verdict).toBe("needs_attorney");
  });
  it("IL real estate is partial even under the cap", () => {
    expect(run({ state: "IL", personalValue: 10_000, realProperty: "yes", realPropertyValue: 90_000 }).verdict).toBe("partial_real_property_needs_other_route");
  });
  it("FL recent death over cap, real property counts", () => {
    const r = run({ state: "FL", deathDate: "2026-08-01", personalValue: 100_000, realProperty: "yes", realPropertyValue: 100_000 });
    expect(r.verdict).toBe("likely_formal_probate");
  });
  it("FL under cap with real property is still simplified", () => {
    expect(run({ state: "FL", deathDate: "2026-08-01", personalValue: 50_000, realProperty: "yes", realPropertyValue: 60_000 }).verdict).toBe("likely_court_simplified");
  });
  it("GA with a will is not the no administration route", () => {
    expect(run({ state: "GA", hasWill: "yes" }).verdict).toBe("likely_formal_probate");
  });
  it("unknown will is flagged", () => {
    expect(run({ personalValue: 1000, hasWill: "unknown" }).willUnknown).toBe(true);
  });
  it("NC spouse unsure shows the higher figure when it would change the answer", () => {
    const r = run({ state: "NC", personalValue: 25_000, spouse: "yes", spouseSoleHeir: "unsure" });
    expect(r.verdict).toBe("likely_formal_probate");
    expect(r.spouseCapIfSoleHeir).toBe(30_000);
  });
  it("spouse tier is ignored without a surviving spouse", () => {
    expect(run({ state: "OH", personalValue: 90_000, spouse: "no", spouseSoleHeir: "yes" }).cap).toBe(35_000);
  });
  it("exactly at the cap qualifies", () => {
    expect(run({ personalValue: 208_850 }).verdict).toBe("likely_affidavit");
  });
  it("state without rules", () => {
    expect(run({ state: "WY", personalValue: 5000 }).verdict).toBe("state_not_covered");
    expect(courtSearchUrl("WY")).toContain("Wyoming");
  });
  it("stale or unverified facts are suppressed", () => {
    const stale = { ...SMALL_ESTATE_RULES.CA, asOf: "2024-01-01" };
    expect(factUsable(stale, TODAY)).toBe(false);
    expect(factUsable({ ...stale, asOf: "2026-10-01", confidence: "unverified" }, TODAY)).toBe(false);
    expect(factUsable(getRule("CA")!, TODAY)).toBe(true);
  });
  it("validates dates", () => {
    expect(validateDeathDate("", TODAY)).toBeTruthy();
    expect(validateDeathDate("2027-01-01", TODAY)).toMatch(/future/);
    expect(validateDeathDate("1985-01-01", TODAY)).toBeTruthy();
    expect(validateDeathDate("2025-02-30", TODAY)).toBeTruthy();
    expect(validateDeathDate("2025-06-01", TODAY)).toBeNull();
  });
  it("every seeded rule carries asOf, source and cite", () => {
    for (const r of Object.values(SMALL_ESTATE_RULES)) {
      expect(r.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.source).toMatch(/^https:/);
      expect(r.statuteCite.length).toBeGreaterThan(3);
    }
    expect(Object.keys(SMALL_ESTATE_RULES).sort()).toEqual(["CA", "FL", "GA", "IL", "MI", "NC", "NY", "OH", "PA", "TX"]);
  });
});
