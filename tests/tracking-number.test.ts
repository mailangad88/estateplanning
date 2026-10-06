import { describe, expect, it } from "vitest";
import { firm } from "@/config/firm";
import { firstTouchFromParams, pickTrackingNumber, telHref } from "@/lib/tracking-number";

const MAIN = "(555) 010-0000";
const NUMBERS = {
  "google/cpc": "(555) 010-0001",
  gbp: "(555) 010-0002",
  "*/email": "(555) 010-0003",
  "bing/cpc": "",
};

describe("pickTrackingNumber", () => {
  it("prefers an exact source/medium match", () => {
    expect(pickTrackingNumber({ source: "google", medium: "cpc" }, NUMBERS, MAIN)).toBe("(555) 010-0001");
    expect(pickTrackingNumber({ source: "Google", medium: "CPC" }, NUMBERS, MAIN)).toBe("(555) 010-0001");
  });

  it("falls back to a source-only match, then a medium-only match", () => {
    expect(pickTrackingNumber({ source: "gbp", medium: "organic" }, NUMBERS, MAIN)).toBe("(555) 010-0002");
    expect(pickTrackingNumber({ source: "newsletter", medium: "email" }, NUMBERS, MAIN)).toBe("(555) 010-0003");
  });

  it("uses the main number when nothing matches, the touch is empty, or the mapped number is blank", () => {
    expect(pickTrackingNumber({ source: "google", medium: "organic" }, NUMBERS, MAIN)).toBe(MAIN);
    expect(pickTrackingNumber({}, NUMBERS, MAIN)).toBe(MAIN);
    expect(pickTrackingNumber(null, NUMBERS, MAIN)).toBe(MAIN);
    expect(pickTrackingNumber({ source: "bing", medium: "cpc" }, NUMBERS, MAIN)).toBe(MAIN);
  });

  it("every configured tracking number is a full phone number", () => {
    for (const n of Object.values(firm.trackingNumbers)) expect(n.replace(/\D/g, "").length).toBe(10);
  });
});

describe("firstTouchFromParams", () => {
  it("reads utm parameters", () => {
    expect(firstTouchFromParams(new URLSearchParams("utm_source=Google&utm_medium=cpc"))).toEqual({ source: "google", medium: "cpc" });
  });

  it("treats click ids as their ad network when utm tags are missing", () => {
    expect(firstTouchFromParams(new URLSearchParams("gclid=abc"))).toEqual({ source: "google", medium: "cpc" });
    expect(firstTouchFromParams(new URLSearchParams("fbclid=abc"))).toEqual({ source: "facebook", medium: "paid_social" });
  });

  it("returns null without campaign parameters", () => {
    expect(firstTouchFromParams(new URLSearchParams("q=1"))).toBeNull();
  });
});

describe("telHref", () => {
  it("keeps digits only", () => {
    expect(telHref("(555) 010-0001")).toBe("tel:5550100001");
  });
});
