import { firm } from "@/config/firm";
import { absoluteUrl, site } from "@/config/site";
import { getAllArticles, getGlossary, getStateGuides, toPlainMarkdown } from "@/lib/content";

export const dynamic = "force-static";

/** Full text of every guide, glossary entry and state guide in one Markdown file for AI assistants. */
export function GET() {
  const parts: string[] = [
    `# ${firm.brandName}: estate planning guides (full text)`,
    "",
    `> General education from ${firm.firmLegalName}. Not legal advice. ${site.reviewStatus}. Laws vary by state and change; confirm with a licensed attorney.`,
    "",
  ];
  const source = (url: string) => `Source: ${absoluteUrl(url)}`;
  for (const a of getAllArticles()) parts.push("---", "", source(a.url), "", toPlainMarkdown(a));
  for (const s of getStateGuides()) parts.push("---", "", source(s.url), "", toPlainMarkdown(s));
  parts.push("---", "", "# Glossary", "");
  for (const g of getGlossary()) parts.push(`- **${g.term}** (${absoluteUrl(g.url)}): ${g.short}`);
  parts.push("");
  return new Response(parts.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
