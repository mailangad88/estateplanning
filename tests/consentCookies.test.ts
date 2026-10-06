import { describe, expect, it } from "vitest";
import { makeChoice, parseChoice, toConsentUpdate } from "@/lib/consent-cookies";

describe("consent cookies", () => {
  it("round-trips a choice", () => {
    const c = makeChoice(true, false, new Date("2026-01-02T03:04:05Z"));
    expect(c).toEqual({ v: 1, analytics: true, ads: false, at: "2026-01-02T03:04:05.000Z" });
    expect(parseChoice(JSON.stringify(c))).toEqual(c);
  });
  it("rejects bad input", () => {
    for (const raw of [null, "", "nope", "null", "[]", '{"v":2,"analytics":true,"ads":true,"at":"2026-01-01T00:00:00Z"}',
      '{"v":1,"analytics":"yes","ads":true,"at":"2026-01-01T00:00:00Z"}', '{"v":1,"analytics":true,"ads":true,"at":"x"}']) {
      expect(parseChoice(raw)).toBeNull();
    }
  });
  it("maps to gtag consent", () => {
    const all = makeChoice(true, true);
    expect(toConsentUpdate(all, false)).toEqual({ ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" });
    expect(toConsentUpdate(makeChoice(false, false), false).analytics_storage).toBe("denied");
  });
  it("GPC keeps ads denied but not analytics", () => {
    const u = toConsentUpdate(makeChoice(true, true), true);
    expect(u.ad_storage).toBe("denied");
    expect(u.ad_user_data).toBe("denied");
    expect(u.ad_personalization).toBe("denied");
    expect(u.analytics_storage).toBe("granted");
  });
});
