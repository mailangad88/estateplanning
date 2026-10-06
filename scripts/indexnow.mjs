#!/usr/bin/env node
/**
 * Tells IndexNow search engines (Bing, Yandex, Seznam, Naver and others; also used by some AI search
 * products) which content pages changed, so new and updated pages are recrawled within hours.
 * Google does not use IndexNow; it picks changes up from sitemap.xml lastmod (submit the sitemap once in
 * Search Console).
 *
 *   SITE_URL=https://www.example.com INDEXNOW_KEY=... node scripts/indexnow.mjs [git-range]
 *
 * git-range defaults to HEAD~1..HEAD. Only content files map to URLs. Pages still pending attorney review
 * are skipped when REQUIRE_ATTORNEY_REVIEW=true. Dry run (prints URLs) when INDEXNOW_KEY is unset.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const range = process.argv[2] ?? "HEAD~1..HEAD";
const site = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const key = process.env.INDEXNOW_KEY;

const changed = execSync(`git diff --name-only --diff-filter=AM ${range} -- content/`, { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

function urlFor(file) {
  let m;
  if ((m = /^content\/learn\/([^/]+)\/index\.md$/.exec(file))) return `/learn/${m[1]}`;
  if ((m = /^content\/learn\/([^/]+)\/([^/]+)\.md$/.exec(file))) return `/learn/${m[1]}/${m[2]}`;
  if ((m = /^content\/glossary\/([^/]+)\.md$/.exec(file))) return `/glossary/${m[1]}`;
  if ((m = /^content\/states\/([^/_][^/]*)\.(md|json)$/.exec(file))) return `/estate-planning/${m[1]}`;
  if ((m = /^content\/(guides|blog|compare|life-events)\/([^/]+)\.md$/.exec(file))) return `/${m[1]}/${m[2]}`;
  return null;
}

function approved(file) {
  if (process.env.REQUIRE_ATTORNEY_REVIEW !== "true" || !file.endsWith(".md") || !fs.existsSync(file)) return true;
  return /^review:\s*"?approved"?\s*$/m.test(fs.readFileSync(file, "utf8").split(/^---$/m)[1] ?? "");
}

const paths = [...new Set(changed.filter(approved).map(urlFor).filter(Boolean))];
if (changed.some((f) => f.startsWith("content/learn/") || f.startsWith("content/states/"))) {
  paths.push("/learn", "/estate-planning", "/sitemap.xml");
}
if (!paths.length) {
  console.log("No content pages changed.");
  process.exit(0);
}
if (!site || !key) {
  console.log(`Dry run (set SITE_URL and INDEXNOW_KEY to submit). ${paths.length} URLs:\n${paths.join("\n")}`);
  process.exit(0);
}

const host = new URL(site).host;
const body = { host, key, keyLocation: `${site}/indexnow-key.txt`, urlList: paths.map((p) => `${site}${p}`) };
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
console.log(`IndexNow: HTTP ${res.status} for ${body.urlList.length} URLs`);
if (res.status >= 400) process.exit(1);
