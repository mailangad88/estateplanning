import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getChecklists, getComparisons, getGuides, getLifeEvents, getPosts } from "@/lib/content";
import {
  getAllArticles,
  getBacklinks,
  getClusterArticles,
  getClusters,
  getGlossary,
  getPillar,
  getStateGuides,
  getStates,
  refToUrl,
} from "@/lib/library";

/**
 * Content quality gates: every planned page exists, every internal link resolves, pages are
 * long enough to be useful, metadata is unique, and no page is orphaned.
 */

const articles = getAllArticles();
const glossary = getGlossary();
const states = getStateGuides();

const STATIC_ROUTES = ["/", "/plan-finder", "/learn", "/glossary", "/estate-planning", "/legal/privacy", "/legal/disclaimer", "/legal/sms-terms", "/legal/how-we-work"];
const validUrls = new Set<string>([
  ...STATIC_ROUTES,
  ...articles.map((a) => a.url),
  ...glossary.map((g) => g.url),
  ...states.map((s) => s.url),
  // Other collections on the site that library pages may link to.
  ...getGuides().map((g) => `/guides/${g.slug}`),
  ...getComparisons().map((c) => `/compare/${c.slug}`),
  ...getPosts().map((p) => `/blog/${p.slug}`),
  ...getLifeEvents().map((l) => `/life-events/${l.slug}`),
  ...getChecklists().map((c) => `/checklists/${c.slug}`),
  "/guides", "/compare", "/blog", "/life-events", "/checklists", "/tools", "/faq", "/resources", "/pricing", "/about", "/contact",
]);

const allPages = [...articles, ...glossary, ...states];

describe("topic map coverage", () => {
  it("has a pillar for every cluster", () => {
    const missing = getClusters().filter((c) => !getPillar(c.slug)).map((c) => c.slug);
    expect(missing).toEqual([]);
  });

  it("has every planned article", () => {
    const missing = getClusters().flatMap((c) =>
      c.articleSlugs.filter((s) => !articles.some((a) => a.cluster === c.slug && a.slug === s)).map((s) => `${c.slug}/${s}`),
    );
    expect(missing).toEqual([]);
  });

  it("has no stray content files outside the topic map", () => {
    const root = path.join(process.cwd(), "content", "learn");
    const files = fs.readdirSync(root).flatMap((c) =>
      fs.readdirSync(path.join(root, c)).map((f) => `/learn/${c}${f === "index.md" ? "" : `/${f.replace(/\.md$/, "")}`}`),
    );
    expect(files.filter((f) => !validUrls.has(f))).toEqual([]);
  });

  it("has a glossary entry for every planned term and a guide for every state", () => {
    expect(glossary.length).toBeGreaterThanOrEqual(70);
    expect(states.map((s) => s.slug).sort()).toEqual(getStates().map((s) => s.slug).sort());
  });
});

describe("links", () => {
  it("every internal link resolves", () => {
    const broken = allPages.flatMap((p) => p.links.filter((l) => !validUrls.has(l)).map((l) => `${p.url} -> ${l}`));
    expect(broken).toEqual([]);
  });

  it("every related reference resolves", () => {
    const refs = [
      ...articles.flatMap((a) => a.related.map((r) => [a.url, refToUrl(r)])),
      ...glossary.flatMap((g) => g.related.map((r) => [g.url, refToUrl(r)])),
      ...states.flatMap((s) => s.related.map((r) => [s.url, refToUrl(r)])),
    ];
    expect(refs.filter(([, u]) => !validUrls.has(u)).map(([from, u]) => `${from} -> ${u}`)).toEqual([]);
  });

  it("every glossary reference resolves", () => {
    const slugs = new Set(glossary.map((g) => g.slug));
    const bad = [
      ...articles.flatMap((a) => a.glossary.filter((g) => !slugs.has(g)).map((g) => `${a.url} -> ${g}`)),
      ...glossary.flatMap((g) => g.seeAlso.filter((s) => !slugs.has(s)).map((s) => `${g.url} -> ${s}`)),
    ];
    expect(bad).toEqual([]);
  });

  it("each pillar links to every article in its cluster", () => {
    const missing = getClusters().flatMap((c) => {
      const pillar = getPillar(c.slug);
      if (!pillar) return [];
      return getClusterArticles(c.slug)
        .filter((a) => !pillar.links.includes(a.url))
        .map((a) => `${pillar.url} missing ${a.url}`);
    });
    expect(missing).toEqual([]);
  });

  it("each article links to its pillar and has enough internal links", () => {
    const weak = articles
      .filter((a) => a.kind === "article")
      .filter((a) => !a.links.includes(`/learn/${a.cluster}`) || new Set(a.links).size < 4)
      .map((a) => a.url);
    expect(weak).toEqual([]);
  });

  it("no article is orphaned (each has an inbound link from another page's body)", () => {
    const orphans = articles.filter((a) => getBacklinks(a.url).length === 0).map((a) => a.url);
    expect(orphans).toEqual([]);
  });
});

describe("page quality", () => {
  it("articles and pillars meet minimum length", () => {
    const short = articles
      .filter((a) => a.wordCount < (a.kind === "pillar" ? 1500 : 900))
      .map((a) => `${a.url} (${a.wordCount})`);
    expect(short).toEqual([]);
  });

  it("state guides meet minimum length", () => {
    expect(states.filter((s) => s.wordCount < 550).map((s) => `${s.url} (${s.wordCount})`)).toEqual([]);
  });

  it("every page has a title, description, answer and FAQs", () => {
    const bad = [...articles, ...states]
      .filter((p) => !p.title || p.description.length < 70 || p.answer.split(/\s+/).length < 25 || p.faqs.length < 3)
      .map((p) => p.url);
    expect(bad).toEqual([]);
  });

  it("titles and descriptions are unique", () => {
    const pages = [...articles, ...states];
    const dupes = (key: "title" | "description") => {
      const seen = new Map<string, string>();
      const out: string[] = [];
      for (const p of pages) {
        const v = p[key].trim().toLowerCase();
        if (seen.has(v)) out.push(`${p.url} duplicates ${seen.get(v)}`);
        else seen.set(v, p.url);
      }
      return out;
    };
    expect(dupes("title")).toEqual([]);
    expect(dupes("description")).toEqual([]);
  });

  it("FAQ questions are not repeated across pages", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const p of [...articles, ...states]) {
      for (const f of p.faqs) {
        const q = f.q.trim().toLowerCase();
        if (seen.has(q) && seen.get(q) !== p.url) dupes.push(`"${f.q}" on ${p.url} and ${seen.get(q)}`);
        else seen.set(q, p.url);
      }
    }
    expect(dupes).toEqual([]);
  });

  it("content avoids restricted marketing claims and referral language", () => {
    // Claims about the firm itself that attorney advertising rules restrict, and referral-model wording.
    const banned = [
      /\b(?:we|our (?:firm|attorneys?|team|lawyers?))\b[^.]{0,40}\b(?:experts?|specialists?|specializes?|the best|top-rated|leading)\b/i,
      /\bwe guarantee\b|\bguaranteed (?:results|outcome)/i,
      /\breferral (?:fee|network|partner)/i,
      /\bpartner attorneys?\b/i,
      /\bour network of\b/i,
    ];
    const hits = allPages.flatMap((p) =>
      banned.filter((re) => re.test(p.markdown)).map((re) => `${p.url}: ${re.source}`),
    );
    expect(hits).toEqual([]);
  });

  it("no body repeats the title as an H1", () => {
    expect(allPages.filter((p) => /^# /m.test(p.markdown)).map((p) => p.url)).toEqual([]);
  });
});

describe("cross-links to the rest of the site", () => {
  it("every mapped guide, comparison, question and life event exists", async () => {
    const { clusterMapPaths, siteLinksFor, toolsFor } = await import("@/lib/site-links");
    const resolved = new Set(getClusters().flatMap((c) => [...siteLinksFor(c.slug), ...toolsFor(c.slug)].map((l) => l.url)));
    expect(clusterMapPaths().filter((p) => !resolved.has(p))).toEqual([]);
  });
});
