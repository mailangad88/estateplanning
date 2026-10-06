import rawScripts from "./data/scripts.json";
import facts from "./data/videoFacts.json";
import config from "./config.json";
import { resolveDeep } from "./lib/resolve.js";

export type Scene = {
  id: string; startSec: number; durationSec: number; voiceover: string; onScreenText: string; visual: string; iconHints?: string[];
};
export type VideoScript = {
  id: number; slug: string; title: string; durationSec: number; summary: string; scenes: Scene[];
  cta: { text: string; url: string; cardSceneId: string };
  disclaimer: { text: string; attorneyAdvertisingLabel: string; sceneId: string; durationSec: number };
  [k: string]: unknown;
};

export const ctx = { config, facts };
export const videos = resolveDeep(rawScripts, ctx) as unknown as VideoScript[];
export const FPS = 30;
export type Aspect = "16:9" | "9:16";
export const SIZES: Record<Aspect, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
};
export const compId = (v: VideoScript, a: Aspect) => `v${String(v.id).padStart(2, "0")}-${v.slug}-${a === "16:9" ? "16x9" : "9x16"}`;
