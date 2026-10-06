import { firm } from "@/config/firm";
import { absoluteUrl, site } from "@/config/site";
import { getClusterArticles, getClusters, getGlossary, getPillar, getStateGuides } from "@/lib/content";

export const dynamic = "force-static";

/** llms.txt (https://llmstxt.org): a Markdown map of the site for AI assistants. */
export function GET() {
  const lines: string[] = [
    `# ${firm.brandName}`,
    "",
    `> Plain-English estate planning education from ${firm.firmLegalName}, an estate planning law firm: wills, living trusts, probate, powers of attorney, healthcare directives, guardianship, special needs, business succession, long-term care and estate taxes. Content is general information, not legal advice, and is ${site.reviewStatus.toLowerCase()}.`,
    "",
    "Each page opens with a short answer, key takeaways and FAQs. A Markdown copy of any page is at /raw/{path}.md, and the full text of every guide is in /llms-full.txt.",
    "",
  ];
  for (const c of getClusters()) {
    const pillar = getPillar(c.slug);
    if (!pillar) continue;
    lines.push(`## ${c.name}`, "");
    lines.push(`- [${pillar.title}](${absoluteUrl(`/raw${pillar.url}.md`)}): ${pillar.description}`);
    for (const a of getClusterArticles(c.slug)) {
      lines.push(`- [${a.title}](${absoluteUrl(`/raw${a.url}.md`)}): ${a.description}`);
    }
    lines.push("");
  }
  const states = getStateGuides();
  if (states.length) {
    lines.push("## Laws by state", "");
    for (const s of states) lines.push(`- [${s.title}](${absoluteUrl(`/raw${s.url}.md`)})`);
    lines.push("");
  }
  lines.push("## Optional", "");
  lines.push(`- [Estate planning glossary](${absoluteUrl("/glossary")}): ${getGlossary().length} terms defined in plain English`);
  lines.push(`- [Plan finder](${absoluteUrl("/plan-finder")}): a short questionnaire that shows what people in a similar situation discuss with an attorney`);
  lines.push(`- [How we work](${absoluteUrl("/legal/how-we-work")})`);
  lines.push("");
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
