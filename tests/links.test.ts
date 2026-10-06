import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TOOLS } from "@/config/tools";
import { EXPLAINERS } from "@/explainers/data";
import { getChecklists, getComparisons, getGlossary, getGuides, getLessons, getLifeEvents, getPosts } from "@/lib/content";

const STATIC = ["/", "/plan-finder", "/resources", "/pricing", "/about", "/contact", "/guides", "/blog", "/compare", "/life-events", "/tools", "/checklists", "/explainers", "/course", "/glossary", "/faq", "/mistakes", "/legal/privacy", "/legal/disclaimer", "/legal/sms-terms", "/legal/how-we-work"];

function knownPaths() {
  const s = new Set(STATIC);
  getGuides().forEach((g) => s.add(`/guides/${g.slug}`));
  getPosts().forEach((p) => s.add(`/blog/${p.slug}`));
  getComparisons().forEach((c) => s.add(`/compare/${c.slug}`));
  getLifeEvents().forEach((l) => s.add(`/life-events/${l.slug}`));
  getChecklists().forEach((c) => s.add(`/checklists/${c.slug}`));
  getLessons().forEach((l) => s.add(`/course/${l.day}`));
  TOOLS.forEach((t) => s.add(`/tools/${t.slug}`));
  EXPLAINERS.forEach((e) => s.add(`/explainers/${e.slug}`));
  return s;
}

describe("internal links in content", () => {
  it("every markdown link points to a page that exists", () => {
    const paths = knownPaths();
    const glossary = new Set(getGlossary().map((g) => g.slug));
    const broken: string[] = [];
    const root = path.join(process.cwd(), "content");
    for (const dir of ["guides", "blog", "compare", "life-events", "course"]) {
      for (const f of fs.readdirSync(path.join(root, dir)).filter((x) => x.endsWith(".md"))) {
        const text = fs.readFileSync(path.join(root, dir, f), "utf8");
        for (const m of text.matchAll(/\]\((\/[^)\s]*)\)/g)) {
          const [p, hash] = m[1].split("#");
          const clean = p.replace(/\/$/, "") || "/";
          if (clean === "/glossary" && hash && !glossary.has(hash)) broken.push(`${dir}/${f}: ${m[1]}`);
          else if (!paths.has(clean)) broken.push(`${dir}/${f}: ${m[1]}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("every related slug resolves", () => {
    const all = new Set([...getGuides(), ...getPosts(), ...getComparisons(), ...getLifeEvents(), ...getChecklists()].map((x) => x.slug));
    const missing: string[] = [];
    for (const doc of [...getGuides(), ...getPosts(), ...getComparisons(), ...getLifeEvents()]) {
      for (const r of doc.related) if (!all.has(r)) missing.push(`${doc.slug} -> ${r}`);
    }
    for (const p of getPosts()) if (!getGuides().some((g) => g.slug === p.pillar)) missing.push(`${p.slug} pillar -> ${p.pillar}`);
    expect(missing).toEqual([]);
  });
});
