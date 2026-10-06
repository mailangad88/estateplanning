import { describe, expect, it } from "vitest";
import { DECISIONS, decisionPath } from "@/config/decisions";
import { TYPES_OF_TRUSTS } from "@/config/decisions/trusts";
import type { DecisionGuide } from "@/config/decisions/types";
import { diagramRegistry } from "@/components/visuals/diagrams/registry";
import { DECISION_ICONS } from "@/components/decision/icons";
import { DECISION_WIDGETS } from "@/components/decision/widgets";
import { isComplete, scoreDecision } from "@/lib/decision";
import { allPages } from "@/lib/pages";
import { getAllArticles } from "@/lib/library";
import { getComparisons } from "@/lib/content";
import { TOOLS } from "@/config/tools";

const words = (s: string) => s.trim().split(/\s+/).length;

// Every guide exported from a data file, registered or not, so a new file is checked before it is wired in.
const FILE_GUIDES: DecisionGuide[] = Object.values(import.meta.glob("../src/config/decisions/*.ts", { eager: true }))
  .flatMap((m) => Object.values(m as Record<string, unknown>))
  .filter((v): v is DecisionGuide => typeof v === "object" && v !== null && "slug" in v && "options" in v && "questions" in v);

describe("decision guide data", () => {
  const known = new Set([
    ...allPages().map((p) => p.path),
    ...getAllArticles().map((a) => a.url),
    ...getComparisons().map((c) => `/compare/${c.slug}`),
    ...TOOLS.map((t) => `/tools/${t.slug}`),
  ]);

  it("registers every guide data file in DECISIONS", () => {
    const registered = new Set(DECISIONS.map((g) => g.slug));
    for (const g of FILE_GUIDES) expect(registered.has(g.slug), `${g.slug} missing from src/config/decisions/index.ts`).toBe(true);
  });

  for (const g of FILE_GUIDES) {
    describe(g.slug, () => {
      const ids = new Set(g.options.map((o) => o.id));

      it("has unique option ids, known families and icons, and a cell for every dimension", () => {
        expect(ids.size).toBe(g.options.length);
        const fams = new Set(g.families.map((f) => f.id));
        for (const o of g.options) {
          expect(fams.has(o.family), `${o.id} family`).toBe(true);
          expect(DECISION_ICONS[o.icon], `${o.id} icon ${o.icon}`).toBeDefined();
          for (const d of g.dimensions) expect(o.cells[d.id], `${o.id}.${d.id}`).toBeDefined();
          expect(o.map.x).toBeGreaterThanOrEqual(0);
          expect(o.map.x).toBeLessThanOrEqual(100);
          expect(o.map.y).toBeGreaterThanOrEqual(0);
          expect(o.map.y).toBeLessThanOrEqual(100);
          expect(o.bestFor.length).toBeGreaterThan(0);
          expect(o.watchOut.length).toBeGreaterThan(0);
        }
      });

      it("only weights options that exist, and every option can be recommended", () => {
        const reachable = new Set<string>();
        for (const q of g.questions) {
          expect(q.choices.length).toBeGreaterThan(1);
          for (const c of q.choices) {
            for (const [opt, pts] of Object.entries(c.weights)) {
              expect(ids.has(opt), `${q.id}.${c.id} -> ${opt}`).toBe(true);
              if (pts > 0) reachable.add(opt);
            }
          }
        }
        expect([...ids].filter((id) => !reachable.has(id))).toEqual([]);
      });

      it("links rules of thumb, diagrams and related pages to things that exist", () => {
        for (const s of g.shortcuts) expect(ids.has(s.pick), s.pick).toBe(true);
        for (const d of g.diagrams) expect(diagramRegistry.some((r) => r.name === d), d).toBe(true);
        for (const w of g.widgets ?? []) expect(DECISION_WIDGETS[w], w).toBeDefined();
        const links = [...g.related.map((r) => r.href), ...g.options.flatMap((o) => (o.learn ? [o.learn.href] : []))];
        expect(links.filter((h) => !known.has(h))).toEqual([]);
      });

      it("is listed in the sitemap pages, stays a draft and has a snippet-length answer", () => {
        expect(known.has(decisionPath(g.slug))).toBe(true);
        expect(g.reviewed).toBe(false);
        expect(words(g.answer)).toBeGreaterThanOrEqual(35);
        expect(words(g.answer)).toBeLessThanOrEqual(80);
        expect(g.faqs.length).toBeGreaterThanOrEqual(5);
        expect(g.howTo.steps.length).toBeGreaterThanOrEqual(3);
        expect(g.title.length).toBeLessThanOrEqual(65);
        expect(g.description.length).toBeLessThanOrEqual(170);
      });
    });
  }
});

describe("scoreDecision", () => {
  const g = TYPES_OF_TRUSTS;

  it("recommends a living trust for a homeowner who wants to skip probate and keep control", () => {
    const r = scoreDecision(g, { goals: ["probate", "incapacity"], home: ["one"], family: ["spouse"], size: ["mid"], insurance: ["no"], care: ["no"], control: ["full"] });
    expect(r.top.option.id).toBe("revocable");
    expect(r.top.reasons).toContain("You want to avoid probate");
  });

  it("puts a special needs trust first when an heir receives benefits", () => {
    const r = scoreDecision(g, { goals: ["disability"], home: ["none"], family: ["benefits"], size: ["small"], insurance: ["no"], care: ["no"], control: ["full"] });
    expect(r.top.option.id).toBe("special-needs");
  });

  it("suggests a Medicaid trust for a healthy older homeowner worried about care costs, with a living trust alongside", () => {
    const r = scoreDecision(g, { goals: ["nursing", "probate"], home: ["one"], family: ["spouse"], size: ["mid"], insurance: ["no"], care: ["likely"], control: ["trade"] });
    expect(r.top.option.id).toBe("medicaid");
    expect(r.also.map((a) => a.option.id)).toContain("revocable");
  });

  it("points blended families to a QTIP trust", () => {
    const r = scoreDecision(g, { goals: ["kids"], home: ["none"], family: ["blended"], size: ["small"], insurance: ["no"], care: ["no"], control: ["full"] });
    expect(r.ranked.slice(0, 2).map((x) => x.option.id)).toContain("qtip");
  });

  it("reports completeness only when every question is answered", () => {
    expect(isComplete(g, { goals: ["probate"] })).toBe(false);
    expect(isComplete(g, Object.fromEntries(g.questions.map((q) => [q.id, [q.choices[0].id]])))).toBe(true);
  });
});
