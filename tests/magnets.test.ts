import { getAllArticles } from "@/lib/library";
import { describe, expect, it } from "vitest";
import { TOOLS } from "@/config/tools";
import { getChecklists, getComparisons, getGlossary, getGuides, getLessons, getLifeEvents, getPosts } from "@/lib/content";
import { getQuizzes } from "@/lib/quizzes";
import { DECISIONS } from "@/config/decisions";
import { MAGNET_CATEGORIES, MAGNET_FORMATS, getMagnets, magnetsFor } from "@/lib/magnets";

const magnets = getMagnets();

function knownPaths() {
  const s = new Set(["/", "/plan-finder", "/free", "/tools", "/guides", "/checklists", "/course", "/glossary", "/pricing", "/contact", "/resources", "/blog", "/compare", "/life-events", "/faq"]);
  getGuides().forEach((g) => s.add(`/guides/${g.slug}`));
  getPosts().forEach((p) => s.add(`/blog/${p.slug}`));
  getComparisons().forEach((c) => s.add(`/compare/${c.slug}`));
  getLifeEvents().forEach((l) => s.add(`/life-events/${l.slug}`));
  getChecklists().forEach((c) => s.add(`/checklists/${c.slug}`));
  getLessons().forEach((l) => s.add(`/course/${l.day}`));
  TOOLS.forEach((t) => s.add(`/tools/${t.slug}`));
  magnets.forEach((m) => s.add(`/free/${m.slug}`));
  getQuizzes().forEach((q) => s.add(`/quizzes/${q.slug}`));
  DECISIONS.forEach((d) => s.add(`/decide/${d.slug}`));
  getAllArticles().forEach((a) => s.add(a.url));
  return s;
}

describe("free resource library", () => {
  it("has a large library", () => {
    expect(magnets.length).toBeGreaterThanOrEqual(30);
  });

  it("every resource has complete metadata", () => {
    const problems: string[] = [];
    for (const m of magnets) {
      if (!m.title || !m.promise || !m.description) problems.push(`${m.slug}: missing title, promise or description`);
      if (!(m.format in MAGNET_FORMATS)) problems.push(`${m.slug}: format ${m.format}`);
      if (!(m.category in MAGNET_CATEGORIES)) problems.push(`${m.slug}: category ${m.category}`);
      if (m.benefits.length < 3) problems.push(`${m.slug}: needs 3+ benefits`);
      if (m.related.length < 1) problems.push(`${m.slug}: no related pages`);
      if (m.reviewed) problems.push(`${m.slug}: marked reviewed before attorney review`);
    }
    expect(problems).toEqual([]);
  });

  it("tags are unique so the CRM can route each one", () => {
    const tags = magnets.map((m) => m.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("is substantive and ends with an attorney section", () => {
    const problems: string[] = [];
    for (const m of magnets) {
      if (m.format === "email-course") {
        if (m.lessons.length !== 5) problems.push(`${m.slug}: ${m.lessons.length} lessons`);
        continue;
      }
      if (m.words < 700) problems.push(`${m.slug}: only ${m.words} words`);
      if (!/^## (When to talk to an attorney|Cuándo hablar con un abogado)/m.test(m.body)) problems.push(`${m.slug}: no attorney section`);
    }
    expect(problems).toEqual([]);
  });

  it("follows the style guide: no em dashes and no banned phrases", () => {
    const banned = /—|navigate the complexities|in today's world|delve|game-changer|comprehensive guide|in conclusion/i;
    expect(magnets.filter((m) => banned.test(m.body) || banned.test(m.title)).map((m) => m.slug)).toEqual([]);
  });

  it("every internal link and related page resolves", () => {
    const paths = knownPaths();
    const glossary = new Set(getGlossary().map((g) => g.slug));
    const broken: string[] = [];
    for (const m of magnets) {
      for (const hit of m.body.matchAll(/\]\((\/[^)\s]*)\)/g)) {
        const [p, hash] = hit[1].split("#");
        const clean = p.replace(/\/$/, "") || "/";
        if (clean === "/glossary" && hash && !glossary.has(hash)) broken.push(`${m.slug}: ${hit[1]}`);
        else if (clean !== "/glossary" && !paths.has(clean)) broken.push(`${m.slug}: ${hit[1]}`);
      }
      for (const r of m.related) if (!paths.has(`/${r}`)) broken.push(`${m.slug} related: ${r}`);
    }
    expect(broken).toEqual([]);
  });

  it("grief resources never use the marketing sequence", () => {
    for (const slug of ["executor-first-30-days-guide", "executor-roadmap", "surviving-spouse-checklist", "executor-5-day-course"]) {
      const m = magnets.find((x) => x.slug === slug);
      if (m) expect(m.sequence, slug).toBe("G");
    }
  });

  it("offers resources on the pages they name, and on blog posts through their pillar guide", () => {
    const m = magnets.find((x) => x.related.some((r) => r.startsWith("guides/")))!;
    const guidePath = `/${m.related.find((r) => r.startsWith("guides/"))}`;
    expect(magnetsFor(guidePath, 100).map((x) => x.slug)).toContain(m.slug);
    const pillar = guidePath.replace("/guides/", "");
    const post = getPosts().find((p) => p.pillar === pillar);
    if (post) expect(magnetsFor(`/blog/${post.slug}`).length).toBeGreaterThan(0);
  });

  it("every article page offers at least one free resource", () => {
    const paths = [
      ...getGuides().map((g) => `/guides/${g.slug}`),
      ...getPosts().map((p) => `/blog/${p.slug}`),
      ...getComparisons().map((c) => `/compare/${c.slug}`),
      ...getLifeEvents().map((l) => `/life-events/${l.slug}`),
    ];
    expect(paths.filter((p) => magnetsFor(p).length === 0)).toEqual([]);
  }, 30_000);
});

describe("magnet page extras", () => {
  it("names only diagrams that exist", async () => {
    const { diagramRegistry } = await import("@/components/visuals/diagrams/registry");
    const names = new Set(diagramRegistry.map((d) => d.name));
    expect(magnets.filter((m) => m.diagram && !names.has(m.diagram)).map((m) => `${m.slug}: ${m.diagram}`)).toEqual([]);
  });

  it("links category extras to real tools, quizzes and decision guides", async () => {
    const { MAGNET_EXTRAS } = await import("@/config/magnet-extras");
    const { getQuiz } = await import("@/lib/quizzes");
    const { getDecision } = await import("@/config/decisions");
    const missing: string[] = [];
    for (const [cat, x] of Object.entries(MAGNET_EXTRAS)) {
      x.tools.filter((s) => !TOOLS.some((t) => t.slug === s)).forEach((s) => missing.push(`${cat} tool ${s}`));
      x.quizzes.filter((s) => !getQuiz(s)).forEach((s) => missing.push(`${cat} quiz ${s}`));
      x.decide.filter((s) => !getDecision(s)).forEach((s) => missing.push(`${cat} decide ${s}`));
    }
    expect(missing).toEqual([]);
    expect(Object.keys(MAGNET_EXTRAS).sort()).toEqual(Object.keys(MAGNET_CATEGORIES).sort());
  });

  it("lists each answered question on one resource only", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const m of magnets.filter((x) => x.lang === "en")) {
      for (const q of m.answers) {
        const k = q.trim().toLowerCase();
        if (seen.has(k)) dupes.push(`${q} (${seen.get(k)}, ${m.slug})`);
        else seen.set(k, m.slug);
      }
    }
    expect(dupes).toEqual([]);
  });
});
