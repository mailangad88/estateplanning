// Social video studio: render a director's VideoPlan (src/server/studio/types.ts) to mp4, a poster jpg and WebVTT captions.
//   node scripts/render-studio.mjs --plan path/to/plan.json --out dir/ [--name slug] [--stills] [--crf 23] [--concurrency 3]
// The plan's format picks the composition: "long" -> StudioLong (1920x1080), "short" -> StudioShort (1080x1920).
// --stills also writes one PNG per scene (taken late in each scene, after its reveals) for review.
// --stills-only skips the mp4.
// Needs Node 22.18+ (imports the caption builder from ../src/studio/video/captions.ts with type stripping).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.findIndex((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  if (i < 0) return d;
  return args[i].includes("=") ? args[i].split("=").slice(1).join("=") : args[i + 1];
};
const flag = (n) => args.includes(`--${n}`);

const planArg = opt("plan");
const outArg = opt("out");
if (!planArg || !outArg) {
  console.error("usage: node scripts/render-studio.mjs --plan plan.json --out dir/ [--name slug] [--stills] [--stills-only]");
  process.exit(1);
}
// Resolve user paths before moving to video/, where the bundle and the webpack aliases expect to run.
const planFile = path.resolve(planArg);
const OUT = path.resolve(outArg);
const { root, BROWSER, makeBundle } = await import("./common.mjs");
process.chdir(root);

const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
if (!Array.isArray(plan.scenes) || !plan.scenes.length) throw new Error(`${planFile}: plan has no scenes`);
const id = plan.format === "short" ? "StudioShort" : "StudioLong";
const want = plan.format === "short" ? [1080, 1920] : [1920, 1080];
if (plan.width !== want[0] || plan.height !== want[1]) console.warn(`warning: plan is ${plan.width}x${plan.height}; ${id} renders ${want[0]}x${want[1]}`);
const name = opt("name") ?? path.basename(planFile).replace(/\.json$/i, "");
const crf = Number(opt("crf", 23));
const concurrency = Number(opt("concurrency", 3));
fs.mkdirSync(OUT, { recursive: true });

process.removeAllListeners("warning"); // silence Node's module-type notice for the .ts imports below
const { buildCaptionPages, captionsToVtt } = await import(pathToFileURL(path.join(root, "../src/studio/video/captions.ts")).href);
const { sceneFrames, sceneStarts } = await import(pathToFileURL(path.join(root, "../src/studio/video/timing.ts")).href);

const t0 = Date.now();
const secs = (t) => ((Date.now() - t) / 1000).toFixed(1) + "s";
const serveUrl = await makeBundle();
console.log(`bundle  ${secs(t0)}`);
const browser = await openBrowser("chrome", { browserExecutable: BROWSER, chromiumOptions: {} });
const inputProps = { plan };
try {
  const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser, logLevel: "error" });
  const starts = sceneStarts(plan);

  // Captions
  const vtt = path.join(OUT, `${name}.vtt`);
  fs.writeFileSync(vtt, captionsToVtt(buildCaptionPages(plan)));
  console.log(`vtt     ${vtt}`);

  // Poster: late in the first scene, once its entrance has finished; captions hidden.
  const first = sceneFrames(plan.scenes[0], plan.fps);
  const posterFrame = Math.min(first - 1, Math.round(plan.fps * 2.2));
  const poster = path.join(OUT, `${name}-poster.jpg`);
  await renderStill({ composition, serveUrl, output: poster, inputProps: { ...inputProps, poster: true }, frame: posterFrame, imageFormat: "jpeg", jpegQuality: 88, puppeteerInstance: browser, logLevel: "error" });
  console.log(`poster  ${poster}`);

  if (flag("stills") || flag("stills-only")) {
    for (const [i, s] of plan.scenes.entries()) {
      const len = sceneFrames(s, plan.fps);
      const frame = starts[i] + Math.max(0, len - Math.round(plan.fps * 1.2));
      const file = path.join(OUT, `${name}-scene${String(i + 1).padStart(2, "0")}-${s.template}.png`);
      await renderStill({ composition, serveUrl, output: file, inputProps, frame, imageFormat: "png", puppeteerInstance: browser, logLevel: "error" });
      console.log(`still   ${file}`);
    }
  }

  if (!flag("stills-only")) {
    const file = path.join(OUT, `${name}.mp4`);
    const tmp = file + ".part.mp4";
    const t1 = Date.now();
    await renderMedia({
      composition, serveUrl, inputProps, outputLocation: tmp, codec: "h264", crf, pixelFormat: "yuv420p", x264Preset: "medium",
      muted: !plan.audioSrc, concurrency, browserExecutable: BROWSER, overwrite: true, logLevel: "error",
    });
    fs.renameSync(tmp, file);
    const mb = (fs.statSync(file).size / 1e6).toFixed(1);
    console.log(`mp4     ${file}  ${(composition.durationInFrames / composition.fps).toFixed(1)}s video, ${mb} MB, rendered in ${secs(t1)}`);
  }
} finally {
  await browser.close({ silent: true });
}
console.log(`done    ${secs(t0)}`);
