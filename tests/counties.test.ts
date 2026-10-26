import { describe, expect, it } from "vitest";
import { countyForCity, getCities, getCounties } from "@/lib/library";
import { countyFaqs, feesFor, splitSource } from "@/lib/counties";
import { allPages } from "@/lib/pages";

const SOURCE = /\(sources?: https?:\/\/[^\s)]+/;

describe("county pages", () => {
  const counties = getCounties("illinois");

  it("publishes Illinois counties with unique slugs", () => {
    expect(counties.length).toBeGreaterThan(5);
    expect(new Set(counties.map((c) => c.slug)).size).toBe(counties.length);
  });

  it("cites one official source on every county and city note", () => {
    for (const c of counties) for (const n of c.notes) expect(n.trim(), `${c.slug}: ${n}`).toMatch(SOURCE);
    for (const c of getCities("illinois")) for (const n of c.localNotes) expect(n.trim(), `${c.slug}: ${n}`).toMatch(SOURCE);
  });

  it("uses no referral or guarantee language", () => {
    const text = JSON.stringify(counties) + JSON.stringify(getCities("illinois"));
    expect(text).not.toMatch(/guarantee|referral fee|refer you to (an|our) (attorney|lawyer)/i);
  });

  it("lists only published city pages, and every city in a county links back to it", () => {
    const cities = getCities("illinois");
    const slugs = new Set(cities.map((c) => c.slug));
    for (const c of counties) for (const s of c.cities) expect(slugs.has(s), `${c.slug} -> ${s}`).toBe(true);
    for (const c of counties) for (const s of c.cities) expect(countyForCity(cities.find((x) => x.slug === s)!)?.slug).toBe(c.slug);
  });

  it("answers fee questions only from the clerk fee table", () => {
    const cook = counties.find((c) => c.slug === "cook")!;
    expect(feesFor(cook)?.estate).toBe(479);
    expect(countyFaqs(cook).some((f) => f.q.includes("cost"))).toBe(true);
    const noFees = counties.find((c) => !feesFor(c));
    if (noFees) expect(countyFaqs(noFees).some((f) => f.q.includes("cost"))).toBe(false);
  });

  it("splits the inline source from a note", () => {
    expect(splitSource("Room 1202. (source: https://example.gov/a)")).toEqual({ text: "Room 1202.", source: "https://example.gov/a" });
  });

  it("puts county pages and the county index in the sitemap and llms.txt page list", () => {
    process.env.SERVED_STATES = process.env.SERVED_STATES || "IL";
    const paths = new Set(allPages().map((p) => p.path));
    expect(paths.has("/estate-planning/illinois/counties")).toBe(true);
    expect(paths.has("/estate-planning/illinois/counties/cook")).toBe(true);
    expect(paths.has("/estate-planning/illinois/chicago")).toBe(true);
  });
});
