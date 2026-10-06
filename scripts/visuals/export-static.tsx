/**
 * Export lead magnet covers and hero/spot illustrations as standalone SVG,
 * PNG and WebP files for email, PDF and social use.
 *   npm run visuals:export
 *
 * Output:
 *   public/media/covers/<slug>.svg|png|webp        (png/webp at 1200x1600)
 *   public/media/covers/<slug>-600.png|webp        (600x800, for email)
 *   public/media/covers/<slug>-og.png              (1200x630 share image)
 * Covers are made for every magnet in content/magnets/*.md (working tree) or, when
 * that folder is absent, from the lead-capture branch via git show (MAGNET_REF to override).
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
import matter from "gray-matter";
import { readdirSync, existsSync } from "node:fs";
import { ResourceCover, coverPropsFromMagnet, magnets, wrapText, type MagnetMeta } from "../../src/components/visuals/covers";
import { Figure } from "../../src/components/visuals/Figure";
import { Pill, Text } from "../../src/components/visuals/primitives";
import { c } from "../../src/components/visuals/tokens";
import { firm } from "../../src/config/firm";
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

async function raster(svg: string, outBase: string, width: number, only?: { png?: boolean; webp?: boolean }) {
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
  if (only?.webp !== false) await sharp(buf).webp({ quality: 88, effort: 6 }).toFile(`${outBase}.webp`);
  console.log(`${outBase}.png ${width}x${height} ${(png.length / 1024).toFixed(0)} KB`);
}

const ref = process.env.MAGNET_REF ?? "origin/claude/lead-capture-tools-9xtt05";

/** Every magnet's frontmatter, from the working tree if present, else from the git ref. */
function loadMagnets(): MagnetMeta[] {
  const dir = join(root, "content/magnets");
  let files: { slug: string; raw: string }[] = [];
  if (existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(".md") && f !== "README.md")) {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => ({ slug: f.replace(/\.md$/, ""), raw: readFileSync(join(dir, f), "utf8") }));
  } else {
    try {
      const names = execFileSync("git", ["ls-tree", "--name-only", ref, "content/magnets/"], { cwd: root, encoding: "utf8" })
        .split("\n")
        .filter((n) => n.endsWith(".md") && !n.endsWith("README.md"));
      files = names.map((n) => ({
        slug: n.replace(/^.*\//, "").replace(/\.md$/, ""),
        raw: execFileSync("git", ["show", `${ref}:${n}`], { cwd: root, encoding: "utf8", maxBuffer: 16 << 20 }),
      }));
    } catch {
      console.warn(`No content/magnets and cannot read ${ref}; exporting the hand-made covers only.`);
    }
  }
  const metas = files.map(({ slug, raw }) => {
    const d = matter(raw).data as Record<string, string>;
    return { slug, title: d.title, promise: d.promise, format: d.format, category: d.category, sequence: d.sequence } as MagnetMeta;
  });
  // Hand-made covers always export, even if their file is missing.
  for (const m of magnets) if (!metas.some((x) => x.slug === m.slug)) metas.push({ slug: m.slug, title: m.title, format: "guide", category: "basics" });
  return metas.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** 1200x630 share image: title on the left, the cover on the right. */
function ogSvg(meta: MagnetMeta): string {
  const props = coverPropsFromMagnet(meta);
  const inner = renderToStaticMarkup(createElement(ResourceCover, { ...props, bare: true }))
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "")
    .replace(/<title[^>]*>.*?<\/title>|<desc[^>]*>.*?<\/desc>/g, "");
  const calm = !!props.calm;
  let size = 60;
  let lines = wrapText(props.title, Math.floor(560 / (size * 0.53)));
  while (lines.length > 4 && size > 40) {
    size -= 4;
    lines = wrapText(props.title, Math.floor(560 / (size * 0.53)));
  }
  const lh = size * 1.14;
  const top = 190;
  const bottom = top + size + (lines.length - 1) * lh;
  const sub = props.subtitle ? wrapText(props.subtitle, 40).slice(0, 3) : [];
  const accent = props.palette === "accent" ? "accent" : props.palette;
  const scale = 0.7;
  const markup = renderToStaticMarkup(
    createElement(
      Figure,
      { width: 1200, height: 630, bare: true, title: props.title, desc: `Share image for ${props.title}` },
      createElement("rect", { width: 1200, height: 630, style: { fill: c.paper } }),
      createElement("rect", { x: 640, width: 560, height: 630, style: { fill: c[`${accent}Tint` as "accentTint"] }, opacity: calm ? 0.6 : 1 }),
      props.kicker ? createElement(Pill, { x: 72, y: 96, text: props.kicker.toUpperCase(), fill: `${accent}Tint` as "accentTint", ink: accent === "accent" ? "accentDeep" : "ink", size: 16 }) : null,
      ...lines.map((l, i) => createElement(Text, { key: `t${i}`, x: 72, y: top + size + i * lh, size, weight: 700, color: "ink" }, l)),
      ...sub.map((l, i) => createElement(Text, { key: `s${i}`, x: 72, y: bottom + 46 + i * 32, size: 24, color: "muted" }, l)),
      createElement(Text, { x: 72, y: 588, size: 22, weight: 700, color: "muted" }, firm.brandName),
      createElement("rect", { x: 746, y: 56, width: 600 * scale, height: 800 * scale, rx: 10, style: { fill: c.ink }, opacity: 0.12, transform: "translate(0 8)" }),
      createElement("g", { transform: `translate(740 48) scale(${scale})`, dangerouslySetInnerHTML: { __html: inner } }),
    ),
  );
  return standalone(markup);
}

async function main() {
  const metas = loadMagnets();
  for (const m of metas) {
    const svg = standalone(renderToStaticMarkup(createElement(ResourceCover, { ...coverPropsFromMagnet(m), bare: true })));
    writeFileSync(join(coversDir, `${m.slug}.svg`), svg);
    await raster(svg, join(coversDir, m.slug), 1200);
    await raster(svg, join(coversDir, `${m.slug}-600`), 600);
    const og = ogSvg(m);
    await raster(og, join(coversDir, `${m.slug}-og`), 1200, { png: true, webp: false });
  }
  console.log(`${metas.length} covers`);
  for (const ill of process.env.COVERS_ONLY ? [] : illustrations) {
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
