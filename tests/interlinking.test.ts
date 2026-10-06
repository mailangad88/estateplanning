import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DECISIONS } from "@/config/decisions";
import { WHAT_IF_SCENARIOS } from "@/config/what-if-scenarios";
import { getAllArticles } from "@/lib/library";
import { getMagnet } from "@/lib/magnets";
import { contextualLinks, suggestEmbeds } from "@/lib/page-embeds";

/**
 * Every library page links into the rest of the site from its own text, not only from the boxes around it
 * (Angad, 2026-10-06: each page interlinked). Visuals on every section come from the article kit
 * (src/config/visual-kit.ts), which has its own tests.
 */
const MIN_LINKS = 6;
const file = (a: { cluster: string; slug: string }) => path.join(process.cwd(), "content", "learn", a.cluster, `${a.slug || "index"}.md`);

describe("interlinking", { timeout: 60_000 }, () => {
  const articles = getAllArticles();

  it(`every library page links at least ${MIN_LINKS} other pages from its text`, () => {
    const thin = articles
      .map((a) => ({ url: a.url, n: new Set(contextualLinks(fs.readFileSync(file(a), "utf8")).filter((l) => l !== a.url)).size }))
      .filter((x) => x.n < MIN_LINKS)
      .map((x) => `${x.url} (${x.n})`);
    expect(thin).toEqual([]);
  });

  it("every library page gets a what-if, decision guide or free resource suggestion that exists", () => {
    const bad: string[] = [];
    for (const a of articles) {
      const s = suggestEmbeds(a);
      if (!s.whatIf.length && !s.decide && !s.resource) bad.push(`${a.url}: nothing suggested`);
      for (const id of s.whatIf) if (!WHAT_IF_SCENARIOS.some((w) => w.id === id)) bad.push(`${a.url}: what-if ${id}`);
      if (s.decide && !DECISIONS.some((d) => d.slug === s.decide)) bad.push(`${a.url}: decide ${s.decide}`);
      if (s.resource && !getMagnet(s.resource)) bad.push(`${a.url}: resource ${s.resource}`);
    }
    expect(bad).toEqual([]);
  });
});
