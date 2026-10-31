import { describe, expect, it } from "vitest";
import {
  authHeader,
  budgetFromEnv,
  buildTask,
  cacheKey,
  estimateCost,
  monthSpend,
  overBudget,
  readCredentials,
} from "@/lib/dataforseo";

describe("dataforseo", () => {
  it("builds tasks for the launch states", () => {
    expect(buildTask("serp", { keywords: ["living trust cost"], location: "il" })).toEqual({
      keyword: "living trust cost",
      location_name: "Illinois,United States",
      language_code: "en",
      depth: 10,
    });
    expect(buildTask("ranked", { target: "familyfutureplanning.com", location: "nj", limit: 5000 })).toMatchObject({
      location_name: "United States",
      limit: 1000,
    });
    expect(buildTask("volume", { keywords: ["will vs trust"], location: "nj" })).toMatchObject({ location_name: "New Jersey,United States" });
    expect(() => buildTask("volume", { keywords: [] })).toThrow(/keywords/);
  });

  it("estimates cost with per-row charges", () => {
    expect(estimateCost("serp", {})).toBe(0.002);
    expect(estimateCost("ranked", { limit: 500 })).toBeCloseTo(0.06, 6);
  });

  it("gives the same cache key regardless of key order", () => {
    expect(cacheKey("serp", { a: 1, b: [1, 2] })).toBe(cacheKey("serp", { b: [1, 2], a: 1 }));
    expect(cacheKey("serp", { a: 1 })).not.toBe(cacheKey("volume", { a: 1 }));
  });

  it("stops before a call that would pass a cap", () => {
    const b = budgetFromEnv(9.95, { DATAFORSEO_MAX_SPEND_USD: "1", DATAFORSEO_MONTHLY_CAP_USD: "10" });
    expect(overBudget(b, 0.01)).toBeNull();
    expect(overBudget(b, 0.075)).toMatch(/monthly cap/);
    expect(overBudget({ ...b, spentThisMonth: 0, spentThisRun: 0.99 }, 0.02)).toMatch(/run cap/);
    expect(budgetFromEnv(0, {})).toMatchObject({ runCap: 1, monthlyCap: 10 });
  });

  it("sums only this month's ledger", () => {
    const now = new Date("2026-11-15T00:00:00Z");
    const lines = [
      { at: "2026-10-31T23:00:00Z", endpoint: "serp", cost: 5 },
      { at: "2026-11-01T01:00:00Z", endpoint: "serp", cost: 0.002 },
      { at: "2026-11-14T01:00:00Z", endpoint: "volume", cost: 0.075 },
    ];
    expect(monthSpend(lines, now)).toBeCloseTo(0.077, 6);
  });

  it("reads credentials and builds basic auth", () => {
    expect(readCredentials({})).toBeNull();
    expect(readCredentials({ DATAFORSEO_USERNAME: "u", DATAFORSEO_PASSWORD: "p" })).toEqual({ login: "u", password: "p" });
    expect(authHeader("u", "p")).toBe(`Basic ${Buffer.from("u:p").toString("base64")}`);
  });
});
