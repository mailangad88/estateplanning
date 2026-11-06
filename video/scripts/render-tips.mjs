// Render the daily social shorts (TipShort) from ../content/social/calendar.json with Remotion.
//   node scripts/render-tips.mjs                      every video whose renderer is "remotion"
//   node scripts/render-tips.mjs --id=v02,v05         just these
//   node scripts/render-tips.mjs --id=v02 --still=90  one PNG frame (layout check)
//   --out=DIR (default ../out/social)  --no-captions  --audio=vo/v02.m4a (path under video/public)  --crf=23
// The Blender renderer (blender/render_short.py) handles the videos whose renderer is "blender".
import fs from "node:fs";
import path from "node:path";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { BROWSER, makeBundle, repoRoot } from "./common.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? "").split("=").slice(1).join("=") || d;
const flag = (n) => args.includes(`--${n}`);
const OUT = path.resolve(opt("out", path.join(repoRoot, "out/social")));
const cal = JSON.parse(fs.readFileSync(path.join(repoRoot, "content/social/calendar.json"), "utf8"));
const ids = opt("id", "") ? opt("id", "").split(",") : cal.videos.filter((v) => (v.renderer ?? "remotion") === "remotion").map((v) => v.id);
const still = opt("still", "");
const captions = !flag("no-captions");
const audioSrc = opt("audio", "") || undefined;
const crf = Number(opt("crf", 23));
const browserExecutable = process.env.REMOTION_BROWSER || BROWSER;

fs.mkdirSync(OUT, { recursive: true });
const serveUrl = await makeBundle();
const browser = await openBrowser("chrome", { browserExecutable });
for (const id of ids) {
  const v = cal.videos.find((x) => x.id === id);
  if (!v) { console.error(`No video ${id}`); process.exitCode = 1; continue; }
  const inputProps = { id, captions, ...(audioSrc ? { audioSrc } : {}) };
  const composition = await selectComposition({ serveUrl, id: "TipShort", inputProps, puppeteerInstance: browser });
  const base = path.join(OUT, `${id}-${v.tip}`);
  const t0 = Date.now();
  if (still) {
    // --still=90 or --still=40,200,420 or --still=scenes (one frame late in each scene)
    let frames = still.split(",").map(Number);
    if (still === "scenes") {
      let t = 0;
      frames = v.blender.scenes.map((s) => { const len = Math.round(s.seconds * 30); const f = t + Math.round(len * 0.8); t += len; return f; });
    }
    for (const f of frames) {
      await renderStill({ serveUrl, composition, inputProps, frame: Math.min(f, composition.durationInFrames - 1), output: `${base}-f${f}.png`, puppeteerInstance: browser });
    }
    console.log(`${id}: frames ${frames.join(",")} -> ${base}-f*.png`);
  } else {
    await renderMedia({ serveUrl, composition, inputProps, codec: "h264", crf, outputLocation: `${base}.mp4`, puppeteerInstance: browser, concurrency: 4 });
    const mb = (fs.statSync(`${base}.mp4`).size / 1024 / 1024).toFixed(2);
    console.log(`${id}: ${(composition.durationInFrames / composition.fps).toFixed(1)}s, ${mb} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${base}.mp4`);
  }
}
await browser.close({ silent: true });
