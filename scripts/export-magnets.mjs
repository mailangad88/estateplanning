// Writes the CRM setup sheet for the free resource library: one row per resource with its
// tag, nurture sequence, URLs and a ready-to-use delivery email. Run: node scripts/export-magnets.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "content", "magnets");
const out = process.argv[2] ?? path.join(ROOT, "exports");
const SITE = process.env.SITE_URL ?? "https://example.com";
fs.mkdirSync(out, { recursive: true });

const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const rows = [["slug", "tag", "sequence", "lang", "format", "title", "landing_url", "view_url", "email_subject", "email_body"]];
const courses = [];

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".md") && x !== "README.md").sort()) {
  const { data, content } = matter(fs.readFileSync(path.join(DIR, f), "utf8"));
  const slug = f.replace(/\.md$/, "");
  const es = data.lang === "es";
  const view = `${SITE}/free/${slug}/view`;
  const course = data.format === "email-course";
  const subject = course
    ? `Day 1: ${(content.match(/^## Day 1:\s*(.+)$/m) ?? [])[1] ?? data.title}`
    : es ? `Su recurso gratuito: ${data.title}` : `Your free ${String(data.format).replace("-", " ")}: ${data.title}`;
  const body = course
    ? `Hi {{first_name | default: "there"}},\n\nThanks for joining ${data.title}. Day 1 is below, and the next lesson arrives tomorrow. You can also read every lesson here: ${view}`
    : es
      ? `Hola {{first_name | default: ""}}:\n\nAquí tiene su copia de "${data.title}": ${view}\n\nPuede imprimirla o guardarla como PDF.`
      : data.sequence === "G"
        ? `Hi {{first_name | default: "there"}},\n\nHere is your copy of "${data.title}": ${view}\n\nTake it one step at a time. If a question comes up, you can reply to this email.`
        : `Hi {{first_name | default: "there"}},\n\nHere is your copy of "${data.title}": ${view}\n\nYou can print it or save it as a PDF. If you'd like help putting it into practice, you can book a consult at ${SITE}/plan-finder.`;
  rows.push([slug, data.tag, data.sequence ?? "B", data.lang ?? "en", data.format, data.title, `${SITE}/free/${slug}`, view, subject, body]);
  if (course) {
    for (const m of content.matchAll(/^## Day (\d+):\s*(.+)\n([\s\S]*?)(?=^## Day \d+:|(?![\s\S]))/gm)) {
      courses.push([slug, data.tag, data.sequence ?? "B", m[1], m[2].trim(), m[3].trim()]);
    }
  }
}

fs.writeFileSync(path.join(out, "magnets-crm.csv"), rows.map((r) => r.map(csv).join(",")).join("\n") + "\n");
fs.writeFileSync(
  path.join(out, "course-emails.csv"),
  [["course", "tag", "sequence", "day", "subject", "body_markdown"], ...courses].map((r) => r.map(csv).join(",")).join("\n") + "\n",
);
console.log(`Wrote ${rows.length - 1} resources and ${courses.length} course emails to ${out}`);
