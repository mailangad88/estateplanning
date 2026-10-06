/**
 * Prints the attorney review queue, highest search value first, as CSV (or a summary with --summary).
 *
 *   npm run review:queue                 # CSV of every unreviewed page
 *   npm run review:queue -- --summary    # counts by risk tier and the first 10 of each
 *   npm run review:queue -- --out file.csv
 *
 * Order and tiers come from src/lib/review-queue.ts. This only reads content; approving a page is the
 * attorney's step (review: approved in its frontmatter, or reviewed: true for guides and posts).
 */
import fs from "node:fs";
import { reviewBatches, reviewQueue } from "../src/lib/review-queue";

const args = process.argv.slice(2);
if (args.includes("--summary")) {
  const b = reviewBatches(10);
  console.log(`${b.total} pages waiting for review: ${b.counts.low} low risk, ${b.counts.medium} medium, ${b.counts.high} high.`);
  for (const tier of ["low", "medium", "high"] as const) {
    console.log(`\n${tier.toUpperCase()} risk, top ${b[tier].length}:`);
    for (const i of b[tier]) console.log(`  ${String(i.score).padStart(3)}  ${i.path}  (${i.reasons.join("; ") || i.kind})`);
  }
} else {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = reviewQueue().map((i, n) => [n + 1, i.score, i.tier, i.kind, i.path, i.title, i.words, i.reasons.join("; ")].map(esc).join(","));
  const csv = ["rank,score,risk,kind,path,title,words,why", ...rows].join("\n") + "\n";
  const out = args[args.indexOf("--out") + 1];
  if (args.includes("--out") && out) fs.writeFileSync(out, csv);
  else process.stdout.write(csv);
}
