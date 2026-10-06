import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { firm } from "@/config/firm";
import { getFaqs, getGlossary } from "@/lib/content";
import { abs } from "@/lib/seo";
import { getAllArticles, getStateGuides, toPlainMarkdown } from "@/lib/library";

export const dynamic = "force-static";

const DIRS: [string, string][] = [
  ["guides", "/guides"],
  ["blog", "/blog"],
  ["compare", "/compare"],
  ["life-events", "/life-events"],
];

/** Every article as markdown in one file, so AI assistants can read and cite the full content. */
export function GET() {
  const out: string[] = [
    `# ${firm.brandName}: full content`,
    "",
    `General estate planning education from ${firm.firmLegalName}. Not legal advice. Laws vary by state.`,
    "",
  ];
  for (const [dir, base] of DIRS) {
    const full = path.join(process.cwd(), "content", dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full).filter((x) => x.endsWith(".md")).sort()) {
      const { data, content } = matter(fs.readFileSync(path.join(full, f), "utf8"));
      const slug = f.replace(/\.md$/, "");
      out.push(`---`, "", `# ${data.title}`, "", `Source: ${abs(`${base}/${slug}`)}`, "");
      if (data.answer) out.push(`Short answer: ${data.answer}`, "");
      out.push(content.replace(/<!--[\s\S]*?-->/g, "").trim(), "");
    }
  }
  for (const page of [...getAllArticles(), ...getStateGuides()]) {
    out.push("---", "", `Source: ${abs(page.url)}`, "", toPlainMarkdown(page));
  }
  out.push("---", "", "# Glossary", "");
  for (const g of getGlossary()) out.push(`- **${g.term}**: ${g.definition}`);
  out.push("", "---", "", "# Frequently asked questions", "");
  for (const f of getFaqs()) out.push(`**${f.q}**`, "", f.a, "");
  return new Response(out.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
