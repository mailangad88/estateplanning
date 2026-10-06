#!/usr/bin/env node
/**
 * Post-build site check (runs in CI after `next build`). Reads every prerendered page in
 * .next/server/app and fails on:
 *   1. internal links that point at no page (broken links)
 *   2. JSON-LD that does not parse, nodes without @type, @id references to the firm, website or
 *      attorney (or anything else on this site and page) that are not defined on the page, and one @id
 *      defined with two different types (the "firm appears as two businesses" bug)
 *   3. duplicate heading ids on a page (they break table-of-contents and deep links)
 *
 * Usage: npm run build && npm run check:site
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), ".next/server/app");
const PUBLIC = path.join(process.cwd(), "public");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.example.com").replace(/\/$/, "");

if (!fs.existsSync(ROOT)) {
  console.error("check-site: .next/server/app not found. Run `npm run build` first.");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const routeOf = (f) => {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/").replace(/\.html$/, "");
  return rel === "index" ? "/" : `/${rel}`;
};

// Every path that answers: prerendered pages, prerendered route handlers (.body files), app route
// folders (dynamic and API routes), and static files in public/.
const known = new Set(htmlFiles.map(routeOf));
for (const f of files) if (f.endsWith(".body")) known.add(`/${path.relative(ROOT, f).replace(/\\/g, "/").replace(/\.body$/, "")}`);
// Dynamic routes rendered on request (no generateStaticParams) accept any value in their dynamic segments.
// Prerendered dynamic routes do not: a link to a slug that was not built is broken.
const dynamicPatterns = [];
const appDir = path.join(process.cwd(), "src/app");
for (const f of walk(appDir)) {
  const rel = path.relative(appDir, f).replace(/\\/g, "/");
  if (!/(^|\/)(page|route)\.tsx?$/.test(rel)) continue;
  const route = ("/" + rel.replace(/(^|\/)(page|route)\.tsx?$/, "")).replace(/\/\([^)]+\)/g, "").replace(/\/$/, "") || "/";
  if (!route.includes("[")) {
    known.add(route);
    continue;
  }
  if (fs.readFileSync(f, "utf8").includes("generateStaticParams")) continue;
  const re = route
    .split("/")
    .map((seg) => (seg.startsWith("[...") || seg.startsWith("[[...") ? ".+" : seg.startsWith("[") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  dynamicPatterns.push(new RegExp(`^${re}$`));
}
if (fs.existsSync(PUBLIC)) for (const f of walk(PUBLIC)) known.add(`/${path.relative(PUBLIC, f).replace(/\\/g, "/")}`);
// Next.js internals and metadata routes.
const ALWAYS_OK = [/^\/_next\//, /\/opengraph-image(-\w+)?$/, /\/icon(\.\w+)?$/, /^\/favicon\.ico$/, /^\/api\//, /^\/sitemaps\/sitemap\/[\w-]+\.xml$/];

function resolves(href) {
  const p = href.replace(/[?#].*$/, "").replace(/\/$/, "") || "/";
  if (known.has(p) || known.has(decodeURIComponent(p))) return true;
  if (ALWAYS_OK.some((re) => re.test(p))) return true;
  return dynamicPatterns.some((re) => re.test(p));
}

const errors = { links: [], jsonld: [], ids: [] };
const ldScriptRe = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
const linkRe = /<a\b[^>]*\shref="(\/[^"]*)"/g;
const headingIdRe = /<h[1-6][^>]*\sid="([^"]+)"/g;

function nodesOf(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => nodesOf(v, out));
  else if (value && typeof value === "object") {
    out.push(value);
    for (const [k, v] of Object.entries(value)) if (k !== "@context") nodesOf(v, out);
  }
  return out;
}

for (const file of htmlFiles) {
  const route = routeOf(file);
  if (route === "/_not-found" || route.startsWith("/_global-error")) continue;
  const html = fs.readFileSync(file, "utf8");
  const pageUrl = `${SITE}${route === "/" ? "" : route}`;

  for (const m of html.matchAll(linkRe)) {
    const href = m[1].replace(/&amp;/g, "&");
    if (!resolves(href)) errors.links.push(`${route} -> ${href}`);
  }

  const headingIds = new Map();
  for (const m of html.matchAll(headingIdRe)) headingIds.set(m[1], (headingIds.get(m[1]) ?? 0) + 1);
  for (const [id, n] of headingIds) if (n > 1) errors.ids.push(`${route}: heading id "${id}" used ${n} times`);

  const defined = new Map();
  const refs = [];
  for (const m of html.matchAll(ldScriptRe)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch (e) {
      errors.jsonld.push(`${route}: JSON-LD does not parse (${e.message})`);
      continue;
    }
    for (const doc of Array.isArray(data) ? data : [data]) {
      if (!doc["@context"]) errors.jsonld.push(`${route}: JSON-LD block without @context`);
    }
    for (const node of nodesOf(data)) {
      const keys = Object.keys(node);
      const isRef = keys.length === 1 && keys[0] === "@id";
      if (isRef) {
        refs.push(node["@id"]);
        continue;
      }
      if (node["@graph"]) continue;
      if (!node["@type"]) {
        errors.jsonld.push(`${route}: node without @type (${JSON.stringify(node).slice(0, 80)})`);
        continue;
      }
      if (node["@id"]) {
        const type = [].concat(node["@type"]).sort().join(",");
        const prev = defined.get(node["@id"]);
        if (prev && prev !== type) errors.jsonld.push(`${route}: ${node["@id"]} is defined as both ${prev} and ${type}`);
        defined.set(node["@id"], type);
      }
    }
  }
  for (const id of new Set(refs)) {
    if (defined.has(id)) continue;
    const base = String(id).split("#")[0].replace(/\/$/, "");
    // References to this page or to site-wide entities (firm, website, attorney) must be on the page.
    // References to another page's node (a glossary term from an article) are fine.
    if (base === SITE || base === pageUrl) errors.jsonld.push(`${route}: @id ${id} is referenced but not defined on the page`);
  }
}

let failed = false;
for (const [kind, list] of Object.entries(errors)) {
  const unique = [...new Set(list)];
  if (!unique.length) continue;
  failed = true;
  console.error(`\n${kind}: ${unique.length} problem(s)`);
  for (const line of unique.slice(0, 50)) console.error(`  ${line}`);
  if (unique.length > 50) console.error(`  ...and ${unique.length - 50} more`);
}
console.log(`check-site: ${htmlFiles.length} pages checked.`);
if (failed) process.exit(1);
console.log("check-site: no broken internal links, JSON-LD problems or duplicate heading ids.");
