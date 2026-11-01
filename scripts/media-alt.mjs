#!/usr/bin/env node
/**
 * Media alt-text and metadata check (runs in CI after `next build`). Every picture and video on a public
 * page must be describable by search engines, AI answer engines and screen readers:
 *
 *   img     every <img> has a non-empty alt
 *   video   every <video> has an aria-label or title, a captions <track>, and the page carries
 *           VideoObject structured data
 *   svg     every <svg role="img"> has an aria-label, aria-labelledby or <title>
 *   og      every page has og:image with a non-empty og:image:alt, and an og:description
 *
 * Fails on any miss. Writes reports/media-alt.json with every problem found.
 *
 * Usage: npm run build && npm run check:media
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), ".next/server/app");
if (!fs.existsSync(ROOT)) {
  console.error("media-alt: .next/server/app not found. Run `npm run build` first.");
  process.exit(1);
}

/** Pages that are not public: signed-in areas, admin, internal previews. */
const SKIP = [/^\/_/, /^\/admin/, /^\/portal/, /^\/client/, /^\/raw/, /^\/visuals/, /^\/my-plan\/(account|open|verify)/, /^\/unsubscribe/, /^\/callback/];

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

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`, "i"))?.[1];
const meta = (html, prop) => html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i"))?.[1];

const problems = [];
let pages = 0, imgs = 0, videos = 0, svgs = 0;

for (const file of walk(ROOT)) {
  const route = routeOf(file);
  if (SKIP.some((re) => re.test(route))) continue;
  const html = fs.readFileSync(file, "utf8");
  if (/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)) continue;
  pages++;
  const add = (kind, detail) => problems.push({ route, kind, detail: detail.slice(0, 200) });

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    imgs++;
    if (!(attr(tag, "alt") ?? "").trim()) add("img-alt", tag);
  }
  const vids = html.match(/<video\b[^>]*>[\s\S]*?<\/video>/gi) ?? [];
  for (const v of vids) {
    videos++;
    const open = v.match(/<video\b[^>]*>/i)[0];
    if (!(attr(open, "aria-label") ?? attr(open, "title") ?? "").trim()) add("video-label", open);
    if (!/<track\b[^>]*kind="(captions|subtitles)"/i.test(v)) add("video-captions", open);
  }
  if (vids.length && !/"@type":"VideoObject"/.test(html)) add("video-schema", "page has a <video> but no VideoObject JSON-LD");
  for (const s of html.match(/<svg\b[^>]*>[\s\S]{0,400}/gi) ?? []) {
    const open = s.match(/<svg\b[^>]*>/i)[0];
    if (!/role="img"/i.test(open)) continue;
    svgs++;
    if (!attr(open, "aria-label") && !attr(open, "aria-labelledby") && !/<title\b/i.test(s)) add("svg-label", open);
  }
  if (route !== "/_not-found" && !/^\/(404|500)$/.test(route)) {
    if (!meta(html, "og:image")) add("og-image", "missing og:image");
    else if (!(meta(html, "og:image:alt") ?? "").trim()) add("og-image-alt", "og:image has no og:image:alt");
    if (!(meta(html, "og:description") ?? "").trim()) add("og-description", "missing og:description");
  }
}

fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/media-alt.json", JSON.stringify({ pages, imgs, videos, svgs, problems }, null, 2));

const byKind = problems.reduce((m, p) => ((m[p.kind] = (m[p.kind] ?? 0) + 1), m), {});
console.log(`media-alt: ${pages} public pages, ${imgs} images, ${videos} videos, ${svgs} labelled-role svgs checked.`);
if (problems.length) {
  console.error(`media-alt: ${problems.length} problems ${JSON.stringify(byKind)}`);
  for (const p of problems.slice(0, 40)) console.error(`  ${p.kind.padEnd(15)} ${p.route}  ${p.detail}`);
  process.exit(1);
}
console.log("media-alt: every image has alt text, every video has a label, captions and VideoObject data.");
