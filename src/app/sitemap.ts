import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";
import { servedStates } from "@/config/firm";
import { getAllArticles, getCities, getGlossary, getStateGuides } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const entry = (url: string, priority: number, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(url),
    lastModified: lastModified || undefined,
    priority,
  });
  const codes = servedStates();
  return [
    entry("/", 1),
    entry("/plan-finder", 0.9),
    entry("/learn", 0.9),
    entry("/glossary", 0.6),
    entry("/estate-planning", 0.7),
    ...getAllArticles().map((a) => entry(a.url, a.kind === "pillar" ? 0.9 : 0.7, a.updated)),
    ...getStateGuides().map((s) => entry(s.url, codes.includes(s.abbr) ? 0.9 : 0.5, s.updated)),
    ...getCities()
      .filter((c) => codes.includes(c.state.abbr))
      .map((c) => entry(c.url, 0.8, c.updated)),
    ...getGlossary().map((g) => entry(g.url, 0.4)),
    entry("/legal/how-we-work", 0.3),
    entry("/legal/disclaimer", 0.2),
    entry("/legal/privacy", 0.2),
  ];
}
