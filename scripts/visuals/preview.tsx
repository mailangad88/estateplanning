/**
 * Render any visual to a PNG for review, using headless Chromium.
 *   npx tsx scripts/visuals/preview.tsx <ExportName> [out.png] [width] [--dark]
 * ExportName is any component exported from src/components/visuals/index.ts.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as visuals from "../../src/components/visuals";

const [name, outArg, widthArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dark = process.argv.includes("--dark");
const Comp = (visuals as Record<string, unknown>)[name];
if (typeof Comp !== "function") {
  console.error(`No export named ${name}`);
  process.exit(1);
}
const width = Number(widthArg ?? 1200);
const out = resolve(outArg ?? `preview-${name}.png`);
const css = readFileSync(resolve(__dirname, "../../src/components/visuals/visuals.css"), "utf8");
const markup = renderToStaticMarkup(createElement(Comp as never, { bare: true }));
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css} body{margin:0;background:${dark ? "#15171a" : "#fbfaf7"}} .wrap{width:${width}px}</style></head><body><div class="wrap">${markup}</div></body></html>`;
const dir = mkdtempSync(join(tmpdir(), "vprev-"));
const file = join(dir, "p.html");
writeFileSync(file, html);
const chrome = process.env.CHROME_BIN ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
// Measure height by rendering once tall, then trimming is overkill; use the SVG's aspect ratio instead.
const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup);
const height = vb ? Math.ceil((width * Number(vb[2])) / Number(vb[1])) : 800;
execFileSync(chrome, [
  "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  `--force-dark-mode=${dark}`, dark ? "--blink-settings=preferredColorScheme=0" : "--blink-settings=preferredColorScheme=1",
  `--window-size=${width},${height}`, `--screenshot=${out}`, `file://${file}`,
], { stdio: "ignore" });
console.log(out);
