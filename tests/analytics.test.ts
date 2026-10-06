import { describe, expect, it } from "vitest";
import { filterEvent, isRemarketingEvent } from "@/lib/analytics";
import { isSensitivePath, SENSITIVE_PATH_PREFIXES } from "@/config/sensitive";
import { getComparisons, getGuides, getLifeEvents } from "@/lib/content";

describe("sensitive paths", () => {
  it("matches the listed prefixes and pages beneath them", () => {
    expect(isSensitivePath("/estate-planning-for/special-needs")).toBe(true);
    expect(isSensitivePath("/estate-planning-for/special-needs/trusts")).toBe(true);
    expect(isSensitivePath("/estate-planning-for/new-diagnosis/")).toBe(true);
    expect(isSensitivePath("/estate-planning-for/lgbtq-couples")).toBe(true);
    expect(isSensitivePath("/guides/special-needs-trusts?x=1")).toBe(true);
    expect(isSensitivePath("/guides/medicaid-and-long-term-care-planning")).toBe(true);
    expect(isSensitivePath("/life-events/serious-diagnosis")).toBe(true);
  });

  it("does not match ordinary pages", () => {
    expect(isSensitivePath("/")).toBe(false);
    expect(isSensitivePath("/guides/how-probate-works")).toBe(false);
    expect(isSensitivePath("/estate-planning-for/new-parents")).toBe(false);
  });

  it("every listed content page exists or is a planned audience page", () => {
    const existing = new Set([
      ...getGuides().map((g) => `/guides/${g.slug}`),
      ...getComparisons().map((c) => `/compare/${c.slug}`),
      ...getLifeEvents().map((l) => `/life-events/${l.slug}`),
    ]);
    const planned = ["/estate-planning-for/", "/life-events/estate-planning-after-a-serious-diagnosis"];
    for (const p of SENSITIVE_PATH_PREFIXES) expect(existing.has(p) || planned.some((x) => p.startsWith(x)), p).toBe(true);
  });

  it("covers every existing guide, comparison or life event about special needs, diagnosis, Medicaid or elder care", () => {
    const topical = /special-needs|diagnosis|medicaid|lgbt|same-sex|aging-parents|elder|dementia/;
    const pages = [
      ...getGuides().map((g) => `/guides/${g.slug}`),
      ...getComparisons().map((c) => `/compare/${c.slug}`),
      ...getLifeEvents().map((l) => `/life-events/${l.slug}`),
    ].filter((p) => topical.test(p));
    for (const p of pages) expect(isSensitivePath(p), p).toBe(true);
  });
});

describe("filterEvent", () => {
  it("passes ordinary events on ordinary pages unchanged", () => {
    expect(filterEvent("cta_book", { from: "sticky" }, "/guides/how-probate-works")).toEqual({ event: "cta_book", from: "sticky" });
    expect(filterEvent("exit_intent_shown", {}, "/")).toEqual({ event: "exit_intent_shown" });
  });

  it("skips remarketing-type events on sensitive pages", () => {
    expect(isRemarketingEvent("exit_intent_shown")).toBe(true);
    expect(isRemarketingEvent("audience_join")).toBe(true);
    expect(filterEvent("exit_intent_shown", {}, "/guides/special-needs-trusts")).toBeNull();
    expect(filterEvent("scroll_depth", { percent: 50 }, "/estate-planning-for/lgbtq")).toBeNull();
  });

  it("drops non-essential params on sensitive pages and flags the event", () => {
    const out = filterEvent("lead_capture", { kind: "magnet", interest: "starter-kit", from: "sticky" }, "/life-events/serious-diagnosis");
    expect(out).toEqual({ event: "lead_capture", from: "sticky", ads_restricted: 1 });
  });

  it("strips health and orientation terms from params on every page", () => {
    const out = filterEvent("lead_capture", { kind: "magnet", interest: "special-needs-trust", topic: "Medicaid planning", step: 2 }, "/tools");
    expect(out).toEqual({ event: "lead_capture", kind: "magnet", step: 2 });
    expect(filterEvent("cta_click", { cta_id: "lgbtq-guide" }, "/")).toEqual({ event: "cta_click" });
  });

  it("does not let props overwrite the event name", () => {
    expect(filterEvent("click_to_call", { event: "other" }, "/")).toEqual({ event: "click_to_call" });
  });
});
