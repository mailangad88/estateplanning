/**
 * Builds the Pagefind site-search index from the same page list as the sitemap and llms.txt, so search
 * never offers a page that is noindexed or unpublished. Runs before `next build` and writes the index to
 * public/pagefind (gitignored); /search loads it in the browser.
 *
 * Usage: npx tsx scripts/build-search-index.mts
 */
import path from "node:path";
import * as pagefind from "pagefind";
import { allPages } from "@/lib/pages";
import { findByUrl, toPlainMarkdown } from "@/lib/library";
import { getComparisons, getGuides, getLifeEvents, getPosts } from "@/lib/content";

const stripMarkdown = (md: string) =>
  md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/[*_`>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();

/** Full text for pages that come from Markdown; other pages are searchable by title and description. */
function bodyText(): Map<string, string> {
  const map = new Map<string, string>();
  for (const g of getGuides()) map.set(`/guides/${g.slug}`, stripHtml(g.html));
  for (const p of getPosts()) map.set(`/blog/${p.slug}`, stripHtml(p.html));
  for (const c of getComparisons()) map.set(`/compare/${c.slug}`, stripHtml(c.html));
  for (const l of getLifeEvents()) map.set(`/life-events/${l.slug}`, stripHtml(l.html));
  return map;
}

async function main() {
  const { index, errors } = await pagefind.createIndex({});
  if (!index) throw new Error(`pagefind: ${errors.join(", ")}`);
  const bodies = bodyText();
  let count = 0;
  for (const page of allPages()) {
    const library = findByUrl(page.path);
    const text = library ? stripMarkdown(toPlainMarkdown(library)) : bodies.get(page.path) ?? "";
    const res = await index.addCustomRecord({
      url: page.path,
      content: `${page.title}. ${page.description} ${text}`,
      language: "en",
      meta: { title: page.title, section: page.section },
      filters: { section: [page.section.replace(/^Library: .*/, "Library")] },
    });
    if (res.errors.length) throw new Error(`pagefind ${page.path}: ${res.errors.join(", ")}`);
    count++;
  }
  await index.writeFiles({ outputPath: path.join(process.cwd(), "public/pagefind") });
  await pagefind.close();
  console.log(`Search index: ${count} pages written to public/pagefind`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
