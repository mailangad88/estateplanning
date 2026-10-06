#!/usr/bin/env node
/**
 * Landing page queue helper. See docs/content-pipeline.md.
 *
 *   node scripts/queue.mjs stats
 *   node scripts/queue.mjs questions [cluster] [n]      # unanswered questions to answer as FAQs (FAQ mode)
 *   node scripts/queue.mjs pace                         # new pages or FAQ-only mode, from the review backlog
 *   node scripts/queue.mjs next [n]                     # top queued items, grouped by cluster
 *   node scripts/queue.mjs claim <cluster> <slug> "<title>" <id> [id...]
 *        # adds the page to content/topic-map.json and marks the ids drafted with that slug
 *   node scripts/queue.mjs mark <status> <id> [id...] [--by /url]
 *        # status: published | covered | skipped | queued | blocked
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const QUEUE = path.join(ROOT, "content", "queue.json");
const MAP = path.join(ROOT, "content", "topic-map.json");
const load = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const save = (f, d) => fs.writeFileSync(f, `${JSON.stringify(d, null, f === QUEUE ? 1 : 2)}\n`);

const [cmd, ...args] = process.argv.slice(2);

/**
 * Pacing: new pages are only worth drafting as fast as the attorney can review them, because unreviewed pages
 * are noindexed in production. While more than REVIEW_BACKLOG_LIMIT library pages wait for review, the daily
 * routine stops adding new URLs and instead answers questions from content/questions.json as FAQ entries on
 * existing pages (docs/content-pipeline.md, "Pacing").
 */
const BACKLOG_LIMIT = Number(process.env.REVIEW_BACKLOG_LIMIT ?? 150);
function reviewBacklog() {
  const root = path.join(ROOT, "content", "learn");
  let waiting = 0;
  for (const c of fs.readdirSync(root)) {
    for (const f of fs.readdirSync(path.join(root, c)).filter((x) => x.endsWith(".md"))) {
      if (!/^review:\s*approved\s*$/m.test(fs.readFileSync(path.join(root, c, f), "utf8"))) waiting++;
    }
  }
  return { waiting, limit: BACKLOG_LIMIT, mode: waiting > BACKLOG_LIMIT ? "faq" : "pages" };
}
function paceLine() {
  const p = reviewBacklog();
  return p.mode === "faq"
    ? `PACE: FAQ mode. ${p.waiting} library pages wait for attorney review (limit ${p.limit}). Add answers as FAQ entries on existing pages; do not create new pages today.`
    : `PACE: new pages allowed. ${p.waiting} library pages wait for review (limit ${p.limit}).`;
}
const queue = load(QUEUE);
const byId = (id) => {
  const item = queue.items.find((i) => i.id === id);
  if (!item) throw new Error(`No queue item ${id}`);
  return item;
};

if (cmd === "stats") {
  const counts = {};
  for (const i of queue.items) counts[i.status] = (counts[i.status] ?? 0) + 1;
  console.log(counts);
} else if (cmd === "questions") {
  const bank = load(path.join(ROOT, "content", "questions.json")).items;
  const cluster = args[0] && !/^\d+$/.test(args[0]) ? args[0] : undefined;
  const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 20);
  const risk = { low: 0, medium: 1, high: 2 };
  const open = bank
    .filter((q) => q.coverage === "none" && (!cluster || q.cluster === cluster))
    .sort((a, b) => (a.suggest === "page") - (b.suggest === "page") || risk[a.risk] - risk[b.risk] || a.cluster.localeCompare(b.cluster))
    .slice(0, n);
  for (const q of open) console.log(`${q.cluster.padEnd(24)} ${q.risk.padEnd(6)} ${q.suggest.padEnd(4)} ${q.q}`);
} else if (cmd === "pace") {
  console.log(paceLine());
} else if (cmd === "next") {
  console.log(paceLine());
  const n = Number(args[0] ?? 20);
  const queued = queue.items
    .filter((i) => i.status === "queued")
    .sort((a, b) => a.priority - b.priority || a.cluster.localeCompare(b.cluster))
    .slice(0, n);
  let cluster = "";
  for (const i of queued) {
    if (i.cluster !== cluster) console.log(`\n${(cluster = i.cluster)}`);
    console.log(`  ${i.id}  p${i.priority}  ${i.intent.padEnd(10)}  ${i.keyword}`);
  }
} else if (cmd === "claim") {
  const [cluster, slug, title, ...rest] = args;
  const ids = rest.filter((x) => x !== "--force");
  if (!cluster || !slug || !title || !ids.length) throw new Error("claim <cluster> <slug> <title> <id...>");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error(`Bad slug ${slug}`);
  if (reviewBacklog().mode === "faq" && !process.argv.includes("--force")) throw new Error(`${paceLine()}\nPass --force only if Angad asked for this page.`);
  const map = load(MAP);
  const c = map.clusters.find((x) => x.slug === cluster);
  if (!c) throw new Error(`Unknown cluster ${cluster}`);
  if (map.clusters.some((x) => x.articles.some(([s]) => s === slug))) throw new Error(`Slug ${slug} already in topic map`);
  c.articles.push([slug, title]);
  save(MAP, map);
  for (const id of ids) Object.assign(byId(id), { status: "drafted", cluster, slug, drafted: new Date().toISOString().slice(0, 10) });
  save(QUEUE, queue);
  console.log(`Claimed ${ids.join(", ")} as /learn/${cluster}/${slug}`);
} else if (cmd === "mark") {
  const byIdx = args.indexOf("--by");
  const by = byIdx >= 0 ? args[byIdx + 1] : undefined;
  const [status, ...ids] = byIdx >= 0 ? args.slice(0, byIdx) : args;
  for (const id of ids) {
    const item = byId(id);
    item.status = status;
    if (by) item.coveredBy = by;
  }
  save(QUEUE, queue);
  console.log(`Marked ${ids.join(", ")} ${status}`);
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]);
}
