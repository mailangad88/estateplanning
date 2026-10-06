// Dev helper: node scripts/preview-stills.mjs <outDir> <videoId> <aspect 16:9|9:16> <sec,sec,...>
import path from "node:path";
import fs from "node:fs";
import { renderStill, selectComposition } from "@remotion/renderer";
import { BROWSER, compId, makeBundle, readJson } from "./common.mjs";

const [outDir, idArg, aspect, secsArg] = process.argv.slice(2);
const scripts = readJson("src/data/scripts.json");
const v = scripts.find((s) => s.id === Number(idArg));
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await makeBundle();
const composition = await selectComposition({ serveUrl, id: compId(v, aspect), browserExecutable: BROWSER });
for (const s of secsArg.split(",")) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(Number(s) * 30));
  const output = path.join(outDir, `v${idArg}-${aspect.replace(":", "x")}-${s}.png`);
  await renderStill({ composition, serveUrl, output, frame, browserExecutable: BROWSER });
  console.log(output);
}
