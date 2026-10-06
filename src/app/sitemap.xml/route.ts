import { abs } from "@/lib/seo";
import { SITEMAP_GROUPS, sitemapPages } from "@/lib/sitemaps";
import { videos } from "@/components/visuals/video/videos";

export const dynamic = "force-static";

/** Sitemap index: one child sitemap per page type, plus the video sitemap. */
export function GET() {
  const latest = (dates: string[]) => dates.filter(Boolean).sort().pop();
  const entries = SITEMAP_GROUPS.map((id) => ({
    loc: abs(`/sitemaps/sitemap/${id}.xml`),
    lastmod: latest(sitemapPages(id).map((p) => p.updated)),
  }));
  entries.push({ loc: abs("/videos/sitemap.xml"), lastmod: latest(videos.map((v) => (v.uploadDate ?? "").slice(0, 10))) });
  const body = entries
    .map((e) => `  <sitemap>\n    <loc>${e.loc}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""}\n  </sitemap>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
