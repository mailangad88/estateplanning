/**
 * Burned-in captions for a VideoPlan, TikTok style: each scene's caption text is spread across the scene
 * by word weight (longer words and pauses after punctuation take longer), then grouped into short pages.
 * Pure TypeScript with no runtime imports, so the render script can import it with Node type stripping
 * and write the same cues to WebVTT.
 */
import type { VideoPlan } from "../../server/studio/types";

export type CaptionToken = { text: string; fromMs: number; toMs: number };
export type CaptionPage = { text: string; startMs: number; endMs: number; tokens: CaptionToken[] };

export const SHORT_LIMITS = { maxChars: 22, maxWords: 4 };
export const LONG_LIMITS = { maxChars: 44, maxWords: 8 };
const STOP = /^(the|a|an|of|to|and|or|by|for|in|on|with|your|is|that|at|as|from|than|but|if|be|are|can|will|who|their|our|her|his|no)$/i;

export function buildCaptionPages(plan: Pick<VideoPlan, "scenes" | "fps" | "format">): CaptionPage[] {
  const limits = plan.format === "short" ? SHORT_LIMITS : LONG_LIMITS;
  const pages: CaptionPage[] = [];
  let sceneStart = 0; // seconds, frame-aligned like the video timeline
  for (const scene of plan.scenes) {
    const dur = Math.max(1, Math.round(scene.durationSec * plan.fps)) / plan.fps;
    const words = (scene.caption || "").trim().split(/\s+/).filter(Boolean);
    if (words.length) {
      const lead = Math.min(0.35, dur * 0.06);
      const tail = Math.min(0.6, dur * 0.08);
      const start = sceneStart + lead;
      const end = sceneStart + dur - tail;
      const weights = words.map((w) => w.length + 2 + (/[.?!]$/.test(w) ? 5 : /[,;:]$/.test(w) ? 2.5 : 0));
      const total = weights.reduce((a, b) => a + b, 0);
      let acc = 0;
      let cur: CaptionToken[] = [];
      let chars = 0;
      const flush = () => {
        if (!cur.length) return;
        pages.push({ text: cur.map((t) => t.text).join(" "), startMs: cur[0].fromMs, endMs: cur[cur.length - 1].toMs, tokens: cur });
        cur = [];
        chars = 0;
      };
      words.forEach((w, i) => {
        const s = start + ((end - start) * acc) / total;
        acc += weights[i];
        const e = start + ((end - start) * acc) / total;
        cur.push({ text: w, fromMs: Math.round(s * 1000), toMs: Math.round(e * 1000) });
        chars += w.length + 1;
        const next = words[i + 1];
        const sentenceEnd = /[.?!]$/.test(w);
        const clause = /[,;:]$/.test(w) && cur.length >= 2;
        // Do not leave one or two words of a sentence alone on the next page when they still fit loosely.
        let rest = 0, restChars = 0;
        for (let k = i + 1; k < words.length; k++) {
          rest++;
          restChars += words[k].length + 1;
          if (/[.?!,;:]$/.test(words[k])) break;
        }
        const orphan = rest <= 2 && chars + restChars <= limits.maxChars + 10 && cur.length + rest <= limits.maxWords + 3;
        const soft = next !== undefined && (chars + next.length > limits.maxChars || cur.length >= limits.maxWords);
        const hard = next !== undefined && (chars + next.length > limits.maxChars + 12 || cur.length >= limits.maxWords + 3);
        // Prefer not to end a page on a small joining word ("the", "of", "and").
        const joiner = STOP.test(w.replace(/[^\w']/g, ""));
        const over = hard || (soft && !orphan && !joiner);
        if (!next || sentenceEnd || clause || over) flush();
      });
      flush();
    }
    sceneStart += dur;
  }
  // Hold each page until the next starts, at most 700 ms past its last word.
  return pages.map((p, i) => ({ ...p, endMs: Math.min(pages[i + 1]?.startMs ?? Infinity, p.endMs + 700) }));
}

const pad = (n: number, l = 2) => String(n).padStart(l, "0");
export function vttTime(ms: number): string {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** WebVTT with one cue per caption page. */
export function captionsToVtt(pages: CaptionPage[]): string {
  return "WEBVTT\n\n" + pages.map((p, i) => `${i + 1}\n${vttTime(p.startMs)} --> ${vttTime(p.endMs)}\n${p.text}\n`).join("\n");
}
