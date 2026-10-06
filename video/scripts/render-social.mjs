// Social templates: bundle once, render stills (PNG) and vertical shorts (MP4) plus post-copy .txt files.
//   node scripts/render-social.mjs [--glossary=all|N] [--faq=all|N] [--shorts=10]
//                                  [--stills-only] [--videos-only] [--force] [--out=DIR]
//                                  [--glossary-slug=a,b] [--faq-index=3,7] [--concurrency=3] [--crf=26]
// --glossary / --faq: how many glossary terms / FAQ items get cards (default all; N = the first N).
// --shorts: how many GlossaryShorts and FaqShorts to render (default 10 each, a spread across the content).
// --glossary-slug / --faq-index: render exactly those entries (cards and shorts) instead.
// Data is read from ../content/glossary.json and faq.json at run time, so new entries need no code changes.
import fs from "node:fs";
import path from "node:path";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { BROWSER, makeBundle, readJson, repoRoot } from "./common.mjs";
import { shorten, slugify } from "../src/social/text.js";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? "").split("=").slice(1).join("=") || d;
const force = flag("force");
const stillsOnly = flag("stills-only"), videosOnly = flag("videos-only");
const crf = Number(opt("crf", 26));
const concurrency = Number(opt("concurrency", 3));
const OUT = opt("out", "/mnt/project-files/media/social");
const limit = (v, total) => (v === "all" ? total : Math.max(0, Math.min(total, Number(v))));

const glossary = JSON.parse(fs.readFileSync(path.join(repoRoot, "content/glossary.json"), "utf8"));
const faq = JSON.parse(fs.readFileSync(path.join(repoRoot, "content/faq.json"), "utf8"));
const config = readJson("src/config.json");
const SITE = config.siteUrl.replace(/\/$/, "");
const categories = [...new Set(faq.map((f) => f.category))];
const fmt = (b) => (b / 1024 / 1024).toFixed(2) + " MB";

const faqName = (i) => `${String(i + 1).padStart(2, "0")}-${slugify(faq[i].q).split("-").slice(0, 7).join("-")}`;

// ---- selection ----
const slugArg = opt("glossary-slug", "");
const idxArg = opt("faq-index", "");
const gNum = limit(opt("glossary", "all"), glossary.length);
const fNum = limit(opt("faq", "all"), faq.length);
const gIdx = slugArg ? slugArg.split(",").map((s) => glossary.findIndex((g) => g.slug === s)).filter((i) => i >= 0) : glossary.slice(0, gNum).map((_, i) => i);
const fIdx = idxArg ? idxArg.split(",").map(Number).filter((i) => i >= 0 && i < faq.length) : faq.slice(0, fNum).map((_, i) => i);
const nShorts = Number(opt("shorts", 10));
// a spread: evenly spaced through the file, so shorts cover different topics and categories
const spread = (n, total) => [...new Set(Array.from({ length: Math.min(n, total) }, (_, i) => Math.floor(((i + 0.5) * total) / Math.min(n, total))))];
const featuredGlossary = slugArg ? gIdx : spread(nShorts, glossary.length);
const featuredFaq = idxArg ? fIdx : spread(nShorts, faq.length);

// ---- captions (post copy): hook, 2-3 sentences, 3-5 hashtags, link. Plain and factual. ----
const camel = (s) => s.replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const tags = (...t) => t.filter((x) => x && x.length > 2 && x.length <= 30).slice(0, 5).map((x) => "#" + x).join(" ");
const sentences = (t) => t.replace(/\b(U)\.(S)\./g, "$1\u0001$2\u0001").match(/[^.!?]+[.!?]+/g)?.map((s) => s.replace(/\u0001/g, ".").trim()) ?? [t];
const post = ({ hook, body, hashtags, link }) =>
  `${hook}\n\n${body}\n\n${hashtags}\n\n${link}\n\nGeneral education, not legal advice. ${config.advertisingLabel}\n`;

const glossaryCopy = (t) => {
  const first = shorten(t.definition, 230);
  return post({
    hook: `${t.term}${t.acronym && t.acronym.toLowerCase() !== t.term.toLowerCase() ? ` (${t.acronym})` : ""}: what it means in plain language.`,
    body: `${first} It is one of the terms in our estate planning glossary, written for people who are not lawyers.`,
    hashtags: tags("EstatePlanning", camel(t.term), "LegalEducation", "FamilyPlanning"),
    link: `${SITE}/glossary#${t.slug}`,
  });
};
const faqCopy = (f) => {
  const ss = sentences(shorten(f.a, 280));
  return post({
    hook: f.q,
    body: `${ss.slice(0, 2).join(" ")} More plain-language answers are on our FAQ page.`,
    hashtags: tags("EstatePlanning", camel(f.category), "FamilyPlanning", "LegalEducation"),
    link: `${SITE}/faq`,
  });
};
const carouselCopy = (cat, n) =>
  post({
    hook: `${cat}: ${n} common estate planning questions, answered plainly.`,
    body: `Swipe through short answers to questions we hear about ${cat.toLowerCase()}. Each answer is general education; your own situation and your state's law can change the details. The full answers are on our FAQ page.`,
    hashtags: tags("EstatePlanning", camel(cat), "FamilyPlanning", "LegalEducation"),
    link: `${SITE}/faq`,
  });

const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

// ---- bundle once ----
console.log("Bundling...");
const serveUrl = await makeBundle();
const browser = await openBrowser("chrome", { browserExecutable: BROWSER, chromiumOptions: {} });
const stats = {};
const bump = (k, size) => { stats[k] ??= { n: 0, bytes: 0 }; stats[k].n++; stats[k].bytes += size; };

const compCache = new Map();
async function comp(id, inputProps) {
  const key = id + JSON.stringify(inputProps);
  if (!compCache.has(key)) compCache.set(key, await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser, logLevel: "error" }));
  return compCache.get(key);
}
async function still(kind, id, inputProps, file) {
  if (fs.existsSync(file) && !force) { bump(kind, fs.statSync(file).size); return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const composition = await comp(id, inputProps);
  await renderStill({ composition, serveUrl, output: file, inputProps, imageFormat: "png", puppeteerInstance: browser, logLevel: "error" });
  bump(kind, fs.statSync(file).size);
}
async function video(kind, id, inputProps, file) {
  if (fs.existsSync(file) && !force) { console.log(`skip    ${path.basename(file)}`); bump(kind, fs.statSync(file).size); return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const composition = await comp(id, inputProps);
  const tmp = file + ".part.mp4";
  const t0 = Date.now();
  await renderMedia({ composition, serveUrl, inputProps, outputLocation: tmp, codec: "h264", crf, pixelFormat: "yuv420p", x264Preset: "medium", muted: true, concurrency, browserExecutable: BROWSER, overwrite: true, logLevel: "error" });
  fs.renameSync(tmp, file);
  bump(kind, fs.statSync(file).size);
  console.log(`render  ${path.relative(OUT, file)}  ${(composition.durationInFrames / composition.fps).toFixed(1)}s  ${fmt(fs.statSync(file).size)}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

if (!videosOnly) {
  const t0 = Date.now();
  for (const i of gIdx) {
    const t = glossary[i];
    const dir = path.join(OUT, "glossary-cards");
    await still("glossary-cards", "GlossaryCard-4x5", { slug: t.slug }, path.join(dir, `${t.slug}-4x5.png`));
    await still("glossary-cards", "GlossaryCard-1x1", { slug: t.slug }, path.join(dir, `${t.slug}-1x1.png`));
    write(path.join(dir, `${t.slug}.txt`), glossaryCopy(t));
  }
  console.log(`glossary cards: ${gIdx.length} terms x 2 sizes`);
  for (const i of fIdx) {
    const dir = path.join(OUT, "faq-cards"), name = faqName(i);
    await still("faq-cards", "FaqCard-4x5", { index: i }, path.join(dir, `${name}-4x5.png`));
    await still("faq-cards", "FaqCard-landscape", { index: i }, path.join(dir, `${name}-1200x627.png`));
    write(path.join(dir, `${name}.txt`), faqCopy(faq[i]));
  }
  console.log(`faq cards: ${fIdx.length} questions x 2 sizes`);
  // carousels: one per FAQ category (cover, up to 6 Q&A slides, CTA)
  const cats = idxArg ? [...new Set(fIdx.map((i) => faq[i].category))] : categories;
  for (const cat of cats) {
    const slug = slugify(cat);
    const dir = path.join(OUT, "carousels", slug);
    const first = await comp("Carousel-4x5", { category: cat, slides: [], slide: 0 });
    const slides = first.props.slides;
    for (let s = 0; s < slides.length; s++)
      await still("carousels", "Carousel-4x5", { category: cat, slides, slide: s }, path.join(dir, `${slug}-${String(s + 1).padStart(2, "0")}-of-${String(slides.length).padStart(2, "0")}.png`));
    write(path.join(dir, `${slug}.txt`), carouselCopy(cat, slides.length - 2));
  }
  console.log(`carousels: ${cats.length} categories (${((Date.now() - t0) / 1000).toFixed(0)}s total for stills)`);
}

if (!stillsOnly) {
  for (const i of featuredGlossary) {
    const t = glossary[i];
    const file = path.join(OUT, "glossary-shorts", `${t.slug}.mp4`);
    await video("glossary-shorts", "GlossaryShort", { slug: t.slug }, file);
    write(path.join(OUT, "glossary-shorts", `${t.slug}.txt`), glossaryCopy(t));
  }
  for (const i of featuredFaq) {
    const name = faqName(i);
    const file = path.join(OUT, "faq-shorts", `${name}.mp4`);
    await video("faq-shorts", "FaqShort", { index: i }, file);
    write(path.join(OUT, "faq-shorts", `${name}.txt`), faqCopy(faq[i]));
  }
}

await browser.close({ silent: true });
console.log("\nSummary");
for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(16)} ${String(v.n).padStart(4)} files  ${fmt(v.bytes)}`);
console.log(`  total            ${fmt(Object.values(stats).reduce((a, v) => a + v.bytes, 0))}`);
