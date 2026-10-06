// Writes captions (.vtt), transcripts (.txt) and src/components/visuals/video/manifest.json.
// Run directly (node scripts/build-manifest.mjs) or via render-all.mjs. Needs no browser.
import fs from "node:fs";
import path from "node:path";
import { repoRoot, readJson } from "./common-lite.mjs";
import { resolveDeep, cleanTitle } from "../src/lib/resolve.js";
import { buildPages, toVtt, HORIZONTAL_LIMITS } from "../src/lib/captions.js";

const config = readJson("src/config.json");
const facts = readJson("src/data/videoFacts.json");
const ctx = { config, facts };
const scripts = resolveDeep(readJson("src/data/scripts.json"), ctx);
const outDir = path.join(repoRoot, "public/media/videos");
const manifestPath = path.join(repoRoot, "src/components/visuals/video/manifest.json");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

const iso = (sec) => {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return "PT" + (m ? m + "M" : "") + (s || !m ? s + "S" : "");
};

const topicRules = [
  ["wills", /\bwills?\b/i], ["trusts", /\btrusts?\b/i], ["probate", /probate/i], ["poa", /power of attorney|powers of attorney/i],
  ["guardianship", /guardian/i], ["medicaid", /medicaid/i], ["special-needs", /special needs|\bSSI\b/i],
  ["beneficiaries", /beneficiar/i], ["estate-tax", /estate tax|exemption/i], ["blended-family", /blended|remarried/i],
  ["executor", /executor|personal representative/i], ["intestacy", /intestacy|without a will/i],
  ["health-care-directive", /health care directive/i], ["funding", /funding|retitle/i],
];

const rel = (u) => u.replace(ctx.config.siteUrl, "");
const entries = [];
for (const v of scripts) {
  const voText = v.scenes.map((s) => s.voiceover.trim()).filter(Boolean).join(" ");
  const pages = buildPages(v, HORIZONTAL_LIMITS);
  fs.writeFileSync(path.join(outDir, `${v.slug}.vtt`), toVtt(pages));
  fs.writeFileSync(path.join(outDir, `${v.slug}.txt`), `${v.title}\n\n${voText}\n`);
  const head = `${v.slug} ${v.title} ${v.summary}`;
  const topics = topicRules.filter(([, re]) => re.test(head) || (voText.match(new RegExp(re.source, "gi")) ?? []).length >= 3).map(([t]) => t);
  const vertical = fs.existsSync(path.join(outDir, `${v.slug}-vertical.mp4`));
  const base = ctx.config.mediaBase;
  entries.push({
    id: `v${String(v.id).padStart(2, "0")}`,
    slug: v.slug,
    title: v.title,
    description: v.summary,
    durationSec: v.durationSec,
    isoDuration: iso(v.durationSec),
    uploadDate: ctx.config.uploadDate,
    funnelStage: v.funnelStage,
    src: `${base}/${v.slug}.mp4`,
    ...(vertical ? { verticalSrc: `${base}/${v.slug}-vertical.mp4` } : {}),
    poster: `${base}/${v.slug}-poster.jpg`,
    captions: `${base}/${v.slug}.vtt`,
    transcriptSrc: `${base}/${v.slug}.txt`,
    transcript: voText,
    chapters: v.scenes.filter((s) => s.id !== v.disclaimer.sceneId).map((s) => ({ title: cleanTitle(s.onScreenText), startSec: s.startSec })),
    topics,
    cta: { label: v.cta.text, href: rel(v.cta.url), url: v.cta.url },
    disclaimer: v.disclaimer.text + " " + v.disclaimer.attorneyAdvertisingLabel,
  });
}
fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2) + "\n");
console.log(`manifest: ${entries.length} videos -> ${path.relative(repoRoot, manifestPath)}`);
