import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { webpackOverride } from "./webpack-override.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = path.resolve(root, "..");
export const BROWSER = process.env.REMOTION_BROWSER || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
export const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

export async function makeBundle() {
  return bundle({ entryPoint: path.join(root, "src/index.ts"), webpackOverride, onProgress: () => {} });
}
export const compId = (v, a) => `v${String(v.id).padStart(2, "0")}-${v.slug}-${a === "16:9" ? "16x9" : "9x16"}`;
