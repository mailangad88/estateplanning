import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";
import { SITEMAP_GROUPS, sitemapPages, sitemapPriority, type SitemapGroup } from "@/lib/sitemaps";

export async function generateSitemaps() {
  return SITEMAP_GROUPS.map((id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = (await props.id) as SitemapGroup;
  return sitemapPages(id).map((p) => ({
    url: abs(p.path),
    lastModified: p.updated,
    changeFrequency: "monthly",
    priority: sitemapPriority(p),
  }));
}
