// Bundle once, then render every composition to public/media/videos.
//   node scripts/render-all.mjs [--force] [--only=<id|slug-fragment>] [--no-vertical] [--vertical-only]
//                               [--no-posters] [--posters-only] [--concurrency=3] [--crf=26]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { BROWSER, compId, makeBundle, readJson, repoRoot } from "./common.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? "").split("=")[1] ?? d;
const force = flag("force");
const concurrency = Number(opt("concurrency", 3));
const crf = Number(opt("crf", 26));
const only = opt("only", "");
const outDir = path.join(repoRoot, "public/media/videos");
fs.mkdirSync(outDir, { recursive: true });

// captions, transcripts and the manifest first (cheap, no browser)
const runManifest = () => execFileSync("node", [path.join(import.meta.dirname, "build-manifest.mjs")], { stdio: "inherit" });
runManifest();

const scripts = readJson("src/data/scripts.json").filter((v) => !only || String(v.id) === only || v.slug.includes(only));
const fmt = (b) => (b / 1024 / 1024).toFixed(2) + " MB";

console.log("Bundling...");
const serveUrl = await makeBundle();

async function posterFor(v) {
  const file = path.join(outDir, `${v.slug}-poster.jpg`);
  if (fs.existsSync(file) && !force) return;
  const composition = await selectComposition({ serveUrl, id: compId(v, "16:9"), browserExecutable: BROWSER, inputProps: { videoId: v.id, aspect: "16:9", hideCaptions: true } });
  const s = v.scenes[1] ?? v.scenes[0];
  const frame = Math.round((s.startSec + s.durationSec * 0.85) * 30);
  await renderStill({ composition, serveUrl, output: file, frame, imageFormat: "jpeg", jpegQuality: 88, browserExecutable: BROWSER, inputProps: { videoId: v.id, aspect: "16:9", hideCaptions: true } });
  console.log(`poster  ${path.basename(file)}  ${fmt(fs.statSync(file).size)}`);
}

async function renderOne(v, aspect) {
  const file = path.join(outDir, aspect === "16:9" ? `${v.slug}.mp4` : `${v.slug}-vertical.mp4`);
  if (fs.existsSync(file) && !force) { console.log(`skip    ${path.basename(file)} (exists)`); return; }
  const composition = await selectComposition({ serveUrl, id: compId(v, aspect), browserExecutable: BROWSER });
  const t0 = Date.now();
  const tmp = file + ".part.mp4";
  await renderMedia({
    composition, serveUrl, outputLocation: tmp, codec: "h264", crf, x264Preset: "medium", pixelFormat: "yuv420p",
    concurrency, muted: true, browserExecutable: BROWSER, overwrite: true, logLevel: "error",
  });
  fs.renameSync(tmp, file);
  console.log(`render  ${path.basename(file)}  ${fmt(fs.statSync(file).size)}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

if (!flag("no-posters")) for (const v of scripts) await posterFor(v);
if (!flag("vertical-only") && !flag("posters-only")) for (const v of scripts) await renderOne(v, "16:9");
if (!flag("no-vertical") && !flag("posters-only")) for (const v of scripts) await renderOne(v, "9:16");
runManifest(); // picks up which vertical files now exist
console.log("done");
