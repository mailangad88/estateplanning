/**
 * Suggests what a library page should embed besides its text: what-if scenarios, a /decide guide and a free
 * resource (src/lib/page-embeds.ts), plus how many pages its text links and how many visual-kit markers it
 * places by hand.
 *
 *   npm run embeds -- trusts/funding-your-trust     # one page
 *   npm run embeds -- --all --out retrofit.csv      # every library page, in attorney review-queue order
 *   npm run embeds -- --questions                   # fill whatIf, decide and resource on content/questions.json
 */
import fs from "node:fs";
import path from "node:path";
import { getAllArticles } from "../src/lib/library";
import { contextualLinks, suggestEmbeds } from "../src/lib/page-embeds";
import { reviewQueue } from "../src/lib/review-queue";

const args = process.argv.slice(2);
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : undefined;
const articles = getAllArticles();

function row(a: (typeof articles)[number]) {
  const md = fs.readFileSync(path.join(process.cwd(), "content", "learn", a.cluster, `${a.slug || "index"}.md`), "utf8");
  const s = suggestEmbeds(a);
  return {
    path: a.url,
    links: new Set(contextualLinks(md).filter((l) => l !== a.url)).size,
    markers: (md.match(/<!--\s*visual:/g) ?? []).length,
    whatIf: s.whatIf.join(" "),
    decide: s.decide ? `/decide/${s.decide}` : "",
    resource: s.resource ? `/free/${s.resource}` : "",
  };
}

if (args.includes("--questions")) {
  // Each question gets the embeds of the page that answers it, or of its cluster's pillar when none does yet.
  const file = path.join(process.cwd(), "content", "questions.json");
  const bank = JSON.parse(fs.readFileSync(file, "utf8")) as { _note: string; items: Record<string, unknown>[] };
  const cache = new Map<string, ReturnType<typeof suggestEmbeds>>();
  for (const q of bank.items) {
    const url = (q.coveredBy as string | null) ?? `/learn/${q.cluster}`;
    const slug = url.split("/").length > 3 ? url.split("/").pop()! : "";
    const key = `${url}|${q.cluster}`;
    if (!cache.has(key)) cache.set(key, suggestEmbeds({ url, cluster: String(q.cluster), slug }));
    const s = cache.get(key)!;
    q.whatIf = s.whatIf;
    q.decide = s.decide ?? null;
    q.resource = s.resource ?? null;
  }
  // One question per line, as the file is written by hand-readable convention.
  const line = (i: Record<string, unknown>) => `  {${Object.entries(i).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")}}`;
  fs.writeFileSync(file, `{\n "_note": ${JSON.stringify(bank._note)},\n "items": [\n${bank.items.map(line).join(",\n")}\n ]\n}\n`);
  console.log(`Embeds added to ${bank.items.length} questions.`);
} else if (args.includes("--all")) {
  const order = new Map(reviewQueue({ includeReviewed: true }).map((i, n) => [i.path, n]));
  const rows = [...articles].sort((a, b) => (order.get(a.url) ?? 1e9) - (order.get(b.url) ?? 1e9)).map(row);
  const cols = ["path", "links", "markers", "whatIf", "decide", "resource"] as const;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => `"${String(r[c]).replace(/"/g, '""')}"`).join(","))].join("\n");
  if (out) fs.writeFileSync(out, `${csv}\n`);
  else console.log(csv);
  if (out) console.log(`${rows.length} pages written to ${out}. ${rows.filter((r) => r.markers === 0).length} have no hand-placed visual yet.`);
} else {
  const key = args.find((a) => !a.startsWith("--"));
  const a = articles.find((x) => `${x.cluster}/${x.slug}` === key || x.url === key || x.url === `/learn/${key}`);
  if (!a) throw new Error(`No library page ${key}. Use <cluster>/<slug>.`);
  console.log(row(a));
}
