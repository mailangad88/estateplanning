import { describe, it, expect } from "vitest";
import { checkDeathTax, exposure, exposureForRange, isUsable, paInheritanceTax, needsHeirs } from "@/lib/tools/deathTax";
import { ALL_STATE_CODES, dataIsConsistent, ESTATE_TAX_META, INHERITANCE_TAX_META } from "@/lib/tools/deathTaxData";
import { STATE_ESTATE_TAX_THRESHOLDS } from "@/config/tools";

const NOW = new Date("2026-10-06");
const base = { marital: "single" as const, netWorth: null, now: NOW };

describe("death tax checker", () => {
  it("covers 50 states plus DC and keeps data in step with config", () => {
    expect(ALL_STATE_CODES.length).toBe(51);
    expect(ALL_STATE_CODES).toContain("DC");
    expect(dataIsConsistent()).toEqual([]);
  });

  it("1: NY 7.0M single is approaching state, well below federal", () => {
    const r = checkDeathTax({ ...base, state: "NY", exactNetWorth: 7_000_000 });
    expect(r.federal.status).toBe("well_below");
    expect(r.stateEstate.status).toBe("approaching");
  });

  it("2: NY 7.5M is in the cliff zone, federal approaching", () => {
    const r = checkDeathTax({ ...base, state: "NY", exactNetWorth: 7_500_000 });
    expect(r.federal.status).toBe("approaching");
    expect(r.stateEstate.status).toBe("cliff_zone");
    expect(r.stateEstate.limit).toBe(7_717_500);
  });

  it("3: NY 8.0M is above the cliff", () => {
    expect(checkDeathTax({ ...base, state: "NY", exactNetWorth: 8_000_000 }).stateEstate.status).toBe("above_cliff");
  });

  it("4: IL married 4.5M uses the single state exemption, no portability", () => {
    const r = checkDeathTax({ ...base, state: "IL", marital: "married", exactNetWorth: 4_500_000 });
    expect(r.stateEstate.status).toBe("above");
    expect(r.stateEstate.portable).toBe(false);
    expect(r.federal.exemption).toBe(30_000_000);
    expect(r.federal.status).toBe("well_below");
  });

  it("5: TX 15m_30m band is could_be_either federally, state has no tax, exact prompt shown", () => {
    const r = checkDeathTax({ ...base, state: "TX", netWorth: "15m_30m" });
    expect(r.federal.status).toBe("could_be_either");
    expect(r.stateEstate.kind).toBe("none");
    expect(r.inheritance.hasTax).toBe(false);
    expect(r.showExactPrompt).toBe(true);
  });

  it("6: CA with NY property under the NY threshold", () => {
    const r = checkDeathTax({ ...base, state: "CA", exactNetWorth: 3_000_000, propertyState: "NY", propertyValue: 1_000_000 });
    expect(r.stateEstate.kind).toBe("none");
    expect(r.property).toMatchObject({ state: "NY", hasEstateTax: true, status: "well_below" });
    expect(r.federal.status).toBe("well_below");
    expect(r.tags).toContain("out_of_state_property");
  });

  it("7: PA children 500,000", () => {
    const r = checkDeathTax({ ...base, state: "PA", exactNetWorth: 2_000_000, heirs: "children", heirAmount: 500_000 });
    expect(r.inheritance.taxUsd).toBe(22_500);
    expect(r.inheritance.taxEarlyUsd).toBe(21_375);
    expect(r.stateEstate.kind).toBe("none");
  });

  it("8: PA siblings 500,000", () => {
    const r = checkDeathTax({ ...base, state: "PA", exactNetWorth: 2_000_000, heirs: "siblings", heirAmount: 500_000 });
    expect(r.inheritance.taxUsd).toBe(60_000);
    expect(r.inheritance.taxEarlyUsd).toBe(57_000);
  });

  it("9: PA spouse pays nothing", () => {
    const r = checkDeathTax({ ...base, state: "PA", heirs: "spouse" });
    expect(r.inheritance.taxUsd).toBe(0);
    expect(r.inheritance.spouseExempt).toBe(true);
  });

  it("10: NJ gives no dollar figure", () => {
    const r = checkDeathTax({ ...base, state: "NJ", exactNetWorth: 2_000_000, heirs: "children", heirAmount: 500_000 });
    expect(r.inheritance.hasTax).toBe(true);
    expect(r.inheritance.computable).toBe(false);
    expect(r.inheritance.taxUsd).toBeNull();
    expect(r.suppressedFields).toContain("inheritance_rates:NJ");
    for (const c of INHERITANCE_TAX_META.NJ.classes) expect(c.rate).toBeNull();
  });

  it("11: MA 2.5M is above with a top rate ceiling only", () => {
    const r = checkDeathTax({ ...base, state: "MA", exactNetWorth: 2_500_000 });
    expect(r.stateEstate.status).toBe("above");
    expect(r.stateEstate.topRatePct).toBe(16);
    expect(JSON.stringify(r)).not.toMatch(/taxUsd":\d/);
  });

  it("12: stale facts suppress numbers but keep the yes/no", () => {
    const r = checkDeathTax({ ...base, state: "MA", exactNetWorth: 2_500_000, now: new Date("2028-03-01") });
    expect(r.stateEstate.kind).toBe("estate_tax");
    expect(r.stateEstate.suppressed).toBe(true);
    expect(r.stateEstate.exemption).toBeNull();
    expect(r.stateEstate.status).toBeNull();
    expect(r.suppressedFields).toContain("state_threshold:MA");
    expect(r.federal.suppressed).toBe(true);
  });

  it("2025 medium facts are usable in 2026 but unverified ones never are", () => {
    expect(isUsable({ asOf: "2025", confidence: "medium" }, NOW)).toBe(true);
    expect(isUsable({ asOf: "2024", confidence: "medium" }, NOW)).toBe(false);
    expect(isUsable({ asOf: "2026", confidence: "unverified" }, NOW)).toBe(false);
  });

  it("every no-tax state says so", () => {
    for (const code of ALL_STATE_CODES) {
      const r = checkDeathTax({ ...base, state: code, exactNetWorth: 1_000_000 });
      const taxed = code in STATE_ESTATE_TAX_THRESHOLDS;
      expect(r.stateEstate.kind).toBe(taxed ? "estate_tax" : "none");
      if (taxed) expect(ESTATE_TAX_META[code].confidence).not.toBe("unverified");
    }
  });

  it("flags tags, heirs question and edge statuses", () => {
    const r = checkDeathTax({ ...base, state: "WA", exactNetWorth: 6_000_000 });
    expect(r.tags).toEqual(expect.arrayContaining(["tool_death_tax", "estate_tax_watch", "high_net_worth"]));
    expect(needsHeirs("PA")).toBe(true);
    expect(needsHeirs("TX", "NJ")).toBe(true);
    expect(needsHeirs("TX")).toBe(false);
    expect(exposure(15_000_000, 15_000_000)).toBe("approaching");
    expect(exposure(15_000_001, 15_000_000)).toBe("above");
    expect(exposureForRange(0, 1_000_000, 500_000, 4_000_000)).toBe("well_below");
    expect(exposureForRange(5_000_000, 8_000_000, 6_500_000, 4_000_000)).toBe("above");
    expect(paInheritanceTax({ lineal: 0, sibling: 0, other: 100_000 }, false)).toBe(15_000);
  });

  it("married federal band over 30m is not claimed above", () => {
    expect(checkDeathTax({ ...base, state: "TX", marital: "married", netWorth: "over_30m" }).federal.status).toBe("could_be_either");
    expect(checkDeathTax({ ...base, state: "TX", exactNetWorth: 40_000_000 }).federal.status).toBe("above");
  });
});
