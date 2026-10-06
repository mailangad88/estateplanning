import { allPages, type SitePage } from "@/lib/pages";

/**
 * The sitemap is split by page type so Search Console reports indexing per type (for example, how many
 * new library pages from the daily pipeline are indexed). /sitemap.xml is the index; each group is served
 * at /sitemaps/sitemap/<id>.xml. Videos keep their own sitemap with video extensions at /videos/sitemap.xml.
 */
export const SITEMAP_GROUPS = ["core", "library", "guides", "tools", "states", "glossary"] as const;
export type SitemapGroup = (typeof SITEMAP_GROUPS)[number];

export function sitemapGroup(page: SitePage): SitemapGroup | null {
  const s = page.section;
  if (s === "Videos") return null; // in /videos/sitemap.xml
  if (s.startsWith("Library")) return "library";
  if (s === "Glossary terms") return "glossary";
  if (s === "Laws by state" || s === "Locations") return "states";
  if (["Tools", "Checklists", "Quizzes", "Free resources", "Explainers"].includes(s)) return "tools";
  if (["Guides", "Decision guides", "Questions answered", "Comparisons", "Life events", "By situation", "7-day course"].includes(s)) return "guides";
  return "core";
}

export function sitemapPages(group: SitemapGroup): SitePage[] {
  return allPages().filter((p) => sitemapGroup(p) === group);
}

export function sitemapPriority(page: SitePage): number {
  if (page.path === "/") return 1;
  if (page.section === "Main" || page.section === "Services") return 0.8;
  if (page.section === "About") return 0.3;
  return 0.6;
}
