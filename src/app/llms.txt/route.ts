import { firm } from "@/config/firm";
import { allPages } from "@/lib/pages";
import { abs } from "@/lib/seo";

export const dynamic = "force-static";

/** llms.txt: a plain-text map of the site for AI assistants (https://llmstxt.org). */
export function GET() {
  const pages = allPages();
  const sections = [...new Set(pages.map((p) => p.section))];
  const lines = [
    `# ${firm.brandName}`,
    "",
    `> Plain-English estate planning education from ${firm.firmLegalName}, an estate planning law firm. Covers wills, trusts, powers of attorney, guardianship, probate, estate taxes and long-term care planning. General information, not legal advice; laws vary by state.`,
    "",
    `Full text of every article: ${abs("/llms-full.txt")}`,
    `Book a consult: ${abs("/plan-finder")} · Phone: ${firm.phone}`,
    "",
  ];
  for (const s of sections) {
    lines.push(`## ${s}`, "");
    for (const p of pages.filter((x) => x.section === s)) lines.push(`- [${p.title}](${abs(p.path)}): ${p.description}`);
    lines.push("");
  }
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
