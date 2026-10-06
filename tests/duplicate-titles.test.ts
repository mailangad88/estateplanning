import { describe, expect, it } from "vitest";
import { allPages } from "@/lib/pages";

/**
 * Two indexable pages aimed at the same query compete with each other, and Google picks one more or less at
 * random. Before launch we folded 17 such pairs into the library (src/config/merged-pages.ts). This keeps new
 * ones from appearing: titles may not match once case, punctuation and filler words are ignored, and may not
 * share 80% or more of their meaningful words.
 */

const STOP = new Set("a an the and or of to for in on your you what is how do does with vs can i if it my are".split(" "));
const words = (t: string) => new Set((t.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => !STOP.has(w)));

describe("duplicate titles", () => {
  it("no two pages target the same title", () => {
    // Article collections only: the library, guides, comparisons and posts. Tools, magnets and state pages
    // reuse topic words on purpose and have their own uniqueness checks.
    const pages = allPages().filter((p) => p.title && /^\/(learn|guides|compare|blog)\//.test(p.path));
    const sets = pages.map((p) => ({ path: p.path, w: words(p.title) }));
    const clashes: string[] = [];
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const a = sets[i].w;
        const b = sets[j].w;
        if (a.size < 2 || b.size < 2) continue;
        let shared = 0;
        for (const w of a) if (b.has(w)) shared++;
        const jaccard = shared / (a.size + b.size - shared);
        if (jaccard >= 0.8) clashes.push(`${sets[i].path} ~ ${sets[j].path}`);
      }
    }
    expect(clashes).toEqual([]);
  });
});
