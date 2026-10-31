import { firm, servedStates, SITE_DISCLAIMER } from "@/config/firm";
import { stateNames } from "@/lib/served-state-names";
import { allPages } from "@/lib/pages";
import { abs } from "@/lib/seo";

export const dynamic = "force-static";

/** llms.txt: a plain-text map of the site for AI assistants (https://llmstxt.org). */
export function GET() {
  const pages = allPages();
  const sections = [...new Set(pages.map((p) => p.section))];
  const states = stateNames(servedStates());
  const where = states.length ? states.join(" and ") : "the states we serve";
  const lines = [
    `# ${firm.brandName}`,
    "",
    `> ${firm.brandName} is an estate planning referral network for ${where}. It explains wills, trusts, powers of attorney, guardianship, probate and long-term care planning in plain English, offers free calculators and checklists, and matches visitors with an appropriate licensed estate planning attorney for a consult. General information, not legal advice.`,
    "",
    "## Key facts",
    "",
    `- What it is: a referral website. Visitors book a consult and are matched with an estate planning attorney licensed in their state.`,
    `- States served: ${where}. Visitors from other states are told so and are not matched.`,
    `- Packages: will, trust and power of attorney packages with published prices; each includes one round of revisions. Prices: ${abs("/pricing")}`,
    `- How it works: ${abs("/how-it-works")} · Book a consult: ${abs("/book")} · Phone: ${firm.phone}`,
    `- How content is written and reviewed: ${abs("/editorial-policy")}`,
    `- Disclaimer: ${SITE_DISCLAIMER}`,
    "",
    "## Machine-readable copies",
    "",
    `- Full text of every article: ${abs("/llms-full.txt")}`,
    `- Glossary: ${abs("/glossary.json")} · All questions and answers: ${abs("/faq.json")}`,
    `- Markdown copy of any library, state or glossary page: add /raw before the path and .md after it, e.g. ${abs("/raw/learn/wills.md")}`,
    `- Sitemap: ${abs("/sitemap.xml")}`,
    "",
  ];
  for (const s of sections) {
    lines.push(`## ${s}`, "");
    for (const p of pages.filter((x) => x.section === s)) lines.push(`- [${p.title}](${abs(p.path)}): ${p.description}`);
    lines.push("");
  }
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
