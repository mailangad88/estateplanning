import { firm } from "@/config/firm";
import { absoluteUrl } from "@/config/site";
import { getAllArticles } from "@/lib/content";

export const dynamic = "force-static";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** RSS feed of every guide, newest first, so readers and aggregators pick up new content. */
export function GET() {
  const items = [...getAllArticles()]
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .map(
      (a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${absoluteUrl(a.url)}</link>
      <guid>${absoluteUrl(a.url)}</guid>
      <description>${esc(a.description)}</description>
      ${a.updated ? `<pubDate>${new Date(`${a.updated}T12:00:00Z`).toUTCString()}</pubDate>` : ""}
    </item>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(firm.brandName)} estate planning guides</title>
    <link>${absoluteUrl("/learn")}</link>
    <description>Plain-English estate planning guides.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
