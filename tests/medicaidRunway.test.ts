import { describe, it, expect } from "vitest";
import { runway, monthsRange, formatMonths, usable, assumptionsFor, compute, validate, type RunwayInput, type Answers } from "@/lib/tools/medicaidRunway";
import { MEDICAID_STATES } from "@/lib/tools/medicaidRunwayData";

const base: RunwayInput = { careCost: 9000, applicantIncome: 2500, countableAssets: 150_000, married: false, assetLimit: 2000, csraRule: "half", growthPctPerYear: 0 };
const NOW = new Date("2026-10-06");

describe("runway", () => {
  it("1 single 150k", () => {
    const r = runway(base);
    expect(r.spendable).toBe(148_000);
    expect(r.shortfallMonthly).toBe(6500);
    expect(r.months).toBe(23);
    expect(monthsRange(23)).toEqual({ low: 19, high: 27 });
  });
  it("2 single 400k", () => {
    const r = runway({ ...base, countableAssets: 400_000 });
    expect(r.months).toBe(62);
    expect(monthsRange(62)).toEqual({ low: 52, high: 72 });
  });
  it("3 income covers", () => {
    expect(runway({ ...base, careCost: 3000, applicantIncome: 3200 }).status).toBe("income_covers");
  });
  it("4 married 300k", () => {
    const r = runway({ ...base, married: true, countableAssets: 300_000, careCost: 10_000, applicantIncome: 2200 });
    expect(r.protectedByCsra).toBe(150_000);
    expect(r.spendable).toBe(148_000);
    expect(r.shortfallMonthly).toBe(7800);
    expect(r.months).toBe(19);
  });
  it("5 married 60k uses CSRA floor", () => {
    const r = runway({ ...base, married: true, countableAssets: 60_000, applicantIncome: 1800 });
    expect(r.protectedByCsra).toBe(32_532);
    expect(r.spendable).toBe(25_468);
    expect(r.months).toBe(4);
  });
  it("6 married 1M uses CSRA cap", () => {
    const r = runway({ ...base, married: true, countableAssets: 1_000_000, careCost: 10_000, applicantIncome: 2200 });
    expect(r.protectedByCsra).toBe(162_660);
    expect(r.spendable).toBe(835_340);
    expect(r.months).toBe(108);
  });
  it("7 assets equal to limit", () => {
    const r = runway({ ...base, countableAssets: 2000 });
    expect(r.status).toBe("already_near_limit");
    expect(r.months).toBe(0);
  });
  it("8 growth steps cost each year", () => {
    const r = runway({ ...base, countableAssets: 400_000, growthPctPerYear: 4 });
    expect(r.months).toBeGreaterThanOrEqual(54);
    expect(r.months).toBeLessThanOrEqual(58);
    expect(r.months!).toBeLessThan(62);
  });
  it("9 maximum-rule state", () => {
    const r = runway({ ...base, married: true, countableAssets: 300_000, csraRule: "maximum" });
    expect(r.protectedByCsra).toBe(162_660);
    expect(r.spendable).toBe(135_340);
  });
  it("small couple assets cannot protect more than they have", () => {
    const r = runway({ ...base, married: true, countableAssets: 20_000, csraRule: "maximum" });
    expect(r.protectedByCsra).toBe(20_000);
    expect(r.status).toBe("already_near_limit");
  });
  it("over horizon", () => {
    expect(runway({ ...base, countableAssets: 50_000_000, careCost: 2501 }).status).toBe("over_horizon");
  });
});

describe("format", () => {
  it("formats months", () => {
    expect(formatMonths(1)).toBe("1 month");
    expect(formatMonths(12)).toBe("1 year");
    expect(formatMonths(23)).toBe("1 year 11 months");
  });
});

describe("R4 suppression", () => {
  it("rejects unverified, null and stale facts", () => {
    expect(usable({ value: 5, asOf: "2026-06-01", confidence: "unverified", source: "" }, NOW)).toBe(false);
    expect(usable({ value: null, asOf: "2026-06-01", confidence: "high", source: "" }, NOW)).toBe(false);
    expect(usable({ value: 5, asOf: "2025-01-01", confidence: "high", source: "" }, NOW)).toBe(false);
    expect(usable({ value: 5, asOf: "2026-06-01", confidence: "medium", source: "" }, NOW)).toBe(true);
  });
  it("PA unverified limit falls back to 2000 and is reported suppressed", () => {
    const a = assumptionsFor("PA", NOW);
    expect(a.assetLimit).toBe(2000);
    expect(a.suppressed).toContain("assetLimit");
  });
  it("unknown state uses defaults", () => {
    const a = assumptionsFor("WY", NOW);
    expect(a.assetLimit).toBe(2000);
    expect(a.csraRule).toBe("half");
    expect(a.hasStateData).toBe(false);
  });
  it("CA csra method and home equity are suppressed, limit is used", () => {
    const a = assumptionsFor("CA", NOW);
    expect(a.csraFact).toBeNull();
    expect(a.homeEquityFact).toBeNull();
    expect(a.assetLimit).toBe(130_000);
  });
  it("no unverified or null-valued fact leaks as usable", () => {
    for (const [code, row] of Object.entries(MEDICAID_STATES)) {
      const a = assumptionsFor(code, NOW);
      for (const f of [a.assetLimitFact, a.csraFact, a.lookbackFact, a.homeEquityFact, a.typicalCost]) {
        if (f) expect(f.confidence).not.toBe("unverified");
      }
      expect(row.assetLimit.source).toMatch(/^https?:/);
    }
  });
});

describe("compute", () => {
  const ans: Answers = { state: "FL", who: "parent", married: false, careCost: 9000, applicantIncome: 2500, countableAssets: 150_000, ownsHome: true, homeEquity: 900_000, growth: false, careSetting: "nursing_home", moveWithin14Days: false };
  it("range and warnings", () => {
    const o = compute(ans, NOW);
    expect(o.range).toEqual({ low: 19, high: 27 });
    expect(o.homeEquityWarning).toBe(true);
    expect(o.urgent).toBe(false);
  });
  it("wider range when limit is assumed", () => {
    const o = compute({ ...ans, state: "PA" }, NOW);
    expect(o.spread).toBe(0.25);
    expect(o.range!.low).toBeLessThan(19);
  });
  it("urgent flag", () => {
    expect(compute({ ...ans, moveWithin14Days: true }, NOW).urgent).toBe(true);
  });
  it("validation", () => {
    expect(validate({ state: "", careCost: 0, countableAssets: -1, applicantIncome: 0 }).errors.length).toBe(3);
    expect(validate({ state: "FL", careCost: 9000, countableAssets: 1, applicantIncome: 0 }).ok).toBe(true);
  });
});
