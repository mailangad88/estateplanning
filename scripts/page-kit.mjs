#!/usr/bin/env node
/**
 * Page kit check (runs in CI after `next build`, next to check:site). Reads every prerendered page in
 * .next/server/app and looks inside <main>, below the page hero, for the five things every public page
 * should carry so it works as a lead page and as an answer source:
 *
 *   visual   a diagram, illustration, table, video, interactive tool or picture card (not just words)
 *   faq      a visible FAQ list with FAQPage structured data
 *   answer   an answer-first summary near the top (.answer-box, the short quotable answer)
 *   cta      a link to /book (the booking page) inside the page body
 *   related  at least 4 links to other pages on the site inside the page body
 *
 * Fails the build on any public, indexable page with no visual (a text-only page). The other four are
 * reported, and enforced for the page families listed in STRICT once they all pass.
 *
 * Writes a per-page report to reports/page-kit.json (and .csv) so the improvement log can read it.
 *
 * Usage: npm run build && npm run check:page-kit
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), ".next/server/app");
if (!fs.existsSync(ROOT)) {
  console.error("page-kit: .next/server/app not found. Run `npm run build` first.");
  process.exit(1);
}

/** Pages that are not public landing pages: tools for signed-in people, admin, forms, legal text. */
const SKIP = [
  /^\/_/,
  /^\/admin/,
  /^\/portal/,
  /^\/client/,
  /^\/my-plan\/(account|open|verify)/,
  /^\/raw/,
  /^\/visuals/,
  /^\/unsubscribe/,
  /^\/callback/,
  /^\/search$/,
  /^\/intake$/,
  /^\/free\/[^/]+\/view$/,
  /^\/resources\/[^/]+\/read$/,
  /^\/legal\//,
  /^\/editorial-policy\/review-log$/,
  /^\/not-in-your-state$/,
];

/** Families where every check is enforced, not only the visual. Add one once its pages all pass. */
const STRICT = [
  "/learn/*", "/learn/*/*", "/glossary/*", "/tools/*", "/blog/*", "/guides/*", "/compare/*", "/decide/*", "/life-events/*",
  "/estate-planning-for/*", "/checklists/*", "/quizzes/*", "/course/*", "/explainers/*", "/estate-planning/*/*",
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const routeOf = (f) => {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/").replace(/\.html$/, "");
  return rel === "index" ? "/" : `/${rel}`;
};

/** The page family: "/learn/wills/x" -> "/learn/[cluster]/[slug]" style key by depth. */
function familyOf(route) {
  const parts = route.split("/").filter(Boolean);
  if (!parts.length) return "/";
  if (parts.length === 1) return `/${parts[0]}`;
  return `/${parts[0]}/${parts.slice(1).map(() => "*").join("/")}`;
}

/** The body of the page: <main> without the page hero (its illustration does not count as content). */
function bodyOf(html) {
  const start = html.indexOf('<main id="main"');
  if (start < 0) return "";
  const end = html.indexOf("</main>", start);
  let main = html.slice(start, end < 0 ? undefined : end);
  main = main.replace(/<section class="band page-hero[\s\S]*?<\/section>/, "");
  return main;
}

const VISUAL_RES = [
  ["diagram", /<svg\b(?![^>]*class="[^"]*lucide)[^>]*(viewBox|role="img")/i],
  ["image", /<img\b/i],
  ["table", /<table\b/i],
  ["figure", /<figure\b/i],
  ["video", /<video\b|<iframe\b|data-remotion|class="[^"]*video-poster/i],
  ["tool", /<(input|select|textarea)\b|class="[^"]*(life-game|picker|whatif|dg-|widget|tool-)/i],
];

const rows = [];
for (const file of walk(ROOT)) {
  const route = routeOf(file);
  if (SKIP.some((re) => re.test(route))) continue;
  const html = fs.readFileSync(file, "utf8");
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
  const body = bodyOf(html);
  if (!body) continue;
  const visuals = VISUAL_RES.filter(([, re]) => re.test(body)).map(([k]) => k);
  const faq = /"@type":"FAQPage"/.test(html) && /<details\b/.test(body);
  const answer = /class="[^"]*answer-box|class="answer[ "]/.test(body);
  const cta = /href="\/book[?"#]/.test(body);
  const internal = new Set([...body.matchAll(/<a\b[^>]*\shref="(\/[^"#?]*)/g)].map((m) => m[1]).filter((h) => h !== route));
  const related = internal.size >= 4;
  const words = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  rows.push({ route, family: familyOf(route), title, words, visual: visuals.length > 0, visuals: visuals.join("+"), faq, answer, cta, related, links: internal.size });
}

rows.sort((a, b) => a.route.localeCompare(b.route));
const outDir = path.join(process.cwd(), "reports");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "page-kit.json"), JSON.stringify(rows, null, 1));
const cols = ["route", "family", "words", "visual", "visuals", "faq", "answer", "cta", "related", "links", "title"];
const csv = [cols.join(",")].concat(rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(",")));
fs.writeFileSync(path.join(outDir, "page-kit.csv"), csv.join("\n") + "\n");

// Summary by family.
const fam = new Map();
for (const r of rows) {
  const f = fam.get(r.family) ?? { pages: 0, visual: 0, faq: 0, answer: 0, cta: 0, related: 0 };
  f.pages++;
  for (const k of ["visual", "faq", "answer", "cta", "related"]) if (r[k]) f[k]++;
  fam.set(r.family, f);
}
console.log("family".padEnd(42), "pages visual   faq answer   cta related");
for (const [k, f] of [...fam].sort((a, b) => b[1].pages - a[1].pages)) {
  console.log(k.padEnd(42), String(f.pages).padStart(5), ...["visual", "faq", "answer", "cta", "related"].map((c) => String(f[c]).padStart(6)));
}

const failures = [];
for (const r of rows) {
  if (!r.visual) failures.push(`${r.route}: text-only page (no diagram, picture, table, video or tool below the hero)`);
  if (STRICT.includes(r.family)) {
    for (const k of ["faq", "answer", "cta", "related"]) if (!r[k]) failures.push(`${r.route}: missing ${k}`);
  }
}
console.log(`page-kit: ${rows.length} public pages checked.`);
if (failures.length) {
  console.error(`\npage-kit: ${failures.length} problem(s)`);
  for (const line of failures.slice(0, 80)) console.error(`  ${line}`);
  if (failures.length > 80) console.error(`  ...and ${failures.length - 80} more`);
  if (process.env.PAGE_KIT_REPORT_ONLY !== "true") process.exit(1);
}
