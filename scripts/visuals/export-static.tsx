/**
 * Export lead magnet covers and hero/spot illustrations as standalone SVG,
 * PNG and WebP files for email, PDF and social use.
 *   npm run visuals:export
 *
 * Output:
 *   public/media/covers/<slug>.svg|png|webp        (png/webp at 1200x1600)
 *   public/media/covers/<slug>-600.png|webp        (600x800, for email)
 *   public/media/illustrations/<Name>.svg|png|webp (heroes 1600 wide, spots 960 wide)
 * Rasterizing uses headless Chromium (same approach as preview.tsx); sharp
 * then palettises the PNGs and writes the WebP.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { MagnetCover, magnets } from "../../src/components/visuals/covers";
import { illustrations } from "../../src/components/visuals/illustrations";

const root = resolve(__dirname, "../..");
const coversDir = join(root, "public/media/covers");
const illusDir = join(root, "public/media/illustrations");
mkdirSync(coversDir, { recursive: true });
mkdirSync(illusDir, { recursive: true });
const chrome = process.env.CHROME_BIN ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const tmp = mkdtempSync(join(tmpdir(), "vexport-"));

/** Standalone SVG: resolve CSS variables to their hex fallbacks and give it a fixed size. */
function standalone(markup: string): string {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup)!;
  return markup
    .replace(/var\(--v-[a-z-]+,\s*(#[0-9a-fA-F]{3,8})\)/g, "$1")
    .replace(/style="display:block;width:100%;height:auto"/, `width="${vb[1]}" height="${vb[2]}"`);
}

async function raster(svg: string, outBase: string, width: number) {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!;
  const height = Math.ceil((width * Number(vb[2])) / Number(vb[1]));
  const sized = svg.replace(/ width="[\d.]+" height="[\d.]+"/, ` width="${width}" height="${height}"`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fbfaf7}svg{display:block}</style></head><body>${sized}</body></html>`;
  const file = join(tmp, "p.html");
  const shot = join(tmp, "shot.png");
  writeFileSync(file, html);
  execFileSync(chrome, ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--window-size=${width},${height}`, `--screenshot=${shot}`, `file://${file}`], { stdio: "ignore" });
  const buf = readFileSync(shot);
  const png = await sharp(buf).png({ palette: true, quality: 92, compressionLevel: 9, effort: 10 }).toBuffer();
  writeFileSync(`${outBase}.png`, png);
  await sharp(buf).webp({ quality: 88, effort: 6 }).toFile(`${outBase}.webp`);
  console.log(`${outBase}.png ${width}x${height} ${(png.length / 1024).toFixed(0)} KB`);
}

async function main() {
  for (const m of magnets) {
    const svg = standalone(renderToStaticMarkup(createElement(MagnetCover, { slug: m.slug, bare: true })));
    writeFileSync(join(coversDir, `${m.slug}.svg`), svg);
    await raster(svg, join(coversDir, m.slug), 1200);
    await raster(svg, join(coversDir, `${m.slug}-600`), 600);
  }
  for (const ill of illustrations) {
    const svg = standalone(renderToStaticMarkup(createElement(ill.component, { bare: true })));
    writeFileSync(join(illusDir, `${ill.name}.svg`), svg);
    await raster(svg, join(illusDir, ill.name), ill.kind === "hero" ? 1600 : 960);
  }
  rmSync(tmp, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
