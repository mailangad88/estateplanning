import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, rulesFor, SITE_RETENTION_YEARS, SITE_TESTIMONIAL_DISCLAIMER, SITE_WEB_LABEL, STATE_RULES } from "@/config/compliance";
import { displayableTestimonials, REVIEW_POLICY, testimonials, type Testimonial } from "@/config/reviews";
import { legalServiceLd } from "@/lib/seo";

describe("compliance data", () => {
  it("every entry is keyed by its code, sourced and dated", () => {
    for (const [code, r] of Object.entries(STATE_RULES)) {
      expect(r.code).toBe(code);
      expect(r.sources.length).toBeGreaterThan(0);
      expect(r.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (r.verified) expect(r.verifiedBy && r.verifiedOn).toBeTruthy();
    }
  });

  it("applies the conservative default to a state with no entry", () => {
    const m = rulesFor(["XX"]);
    expect(m.missing).toEqual(["XX"]);
    expect(m.unverified).toEqual(["XX"]);
    expect(m.webLabels).toContain(DEFAULT_RULES.webLabel);
    expect(m.needsOfficeLocality).toBe(true);
    expect(m.filingRequired).toEqual(["XX"]);
  });

  it("merges strictest-wins across states", () => {
    const m = rulesFor(["ny", "TX", "FL", "TX"]);
    expect(m.states).toEqual(["NY", "TX", "FL"]);
    expect(m.missing).toEqual([]);
    expect(m.webLabels).toEqual([SITE_WEB_LABEL]);
    expect(m.filingRequired).toEqual(["TX", "FL"]);
    expect(m.retentionYears).toBe(Math.max(SITE_RETENTION_YEARS, 4, 3));
    expect(m.needsOfficeLocality).toBe(true);
    expect(m.testimonialDisclaimers).toContain(SITE_TESTIMONIAL_DISCLAIMER);
    expect(m.testimonialDisclaimers).toContain(STATE_RULES.FL.testimonialDisclaimer);
  });
});

describe("review display policy", () => {
  it("ships with no testimonials", () => {
    expect(testimonials).toEqual([]);
    expect(REVIEW_POLICY.aggregateRatingMarkup).toBe(false);
  });

  it("only displays consented, uncompensated, attorney-approved testimonials", () => {
    const base: Testimonial = {
      id: "t1",
      quote: "q",
      attribution: "A. B.",
      source: "Client email",
      date: "2026-01-01",
      consent: { obtainedOn: "2026-01-02", recordRef: "crm-1" },
      compensated: false,
      attorneyApproved: true,
    };
    expect(displayableTestimonials([base])).toHaveLength(1);
    expect(displayableTestimonials([{ ...base, compensated: true }])).toHaveLength(0);
    expect(displayableTestimonials([{ ...base, attorneyApproved: false }])).toHaveLength(0);
    expect(displayableTestimonials([{ ...base, consent: { obtainedOn: "", recordRef: "" } }])).toHaveLength(0);
  });

  it("never emits AggregateRating or Review structured data", () => {
    expect(JSON.stringify(legalServiceLd())).not.toMatch(/aggregateRating|"Review"/i);
    const bad = /["']@type["']\s*:\s*["'](AggregateRating|Review)["']|\baggregateRating\s*:/;
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(e.name) && bad.test(fs.readFileSync(full, "utf8"))) hits.push(full);
      }
    };
    walk(path.join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });
});
