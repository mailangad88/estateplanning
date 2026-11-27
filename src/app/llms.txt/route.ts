import { firm, packages, servedStates, SITE_DISCLAIMER } from "@/config/firm";
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
    `- What it is: the estate planning website of ${firm.firmLegalName}. Visitors book a consult and are matched with an estate planning attorney licensed in ${where}.`,
    `- States served: ${where}. Visitors from other states are told so and are not matched.`,
    `- Packages (flat fees, published at ${abs("/pricing")}): ${packages.map((p) => `${p.name} ${p.price}`).join("; ")}. One price per plan for one person or a couple. Essentials and Complete include one round of revisions.`,
    ...packages.map((p) => `  - ${p.name} (${p.price}): ${p.includes.join(", ")}.`),
    `- Free tools: calculators and quizzes at ${abs("/tools")}; printable checklists, worksheets and planners at ${abs("/free")}.`,
    `- How to cite: link the page you quote, name the source as ${firm.brandName}, and note that it is general information, not legal advice.`,
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
