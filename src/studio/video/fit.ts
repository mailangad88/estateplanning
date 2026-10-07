/**
 * Text measuring and fitting for the studio templates. The site has no @remotion/layout-utils, so this is a
 * small measure-and-shrink helper on a canvas 2D context, measured with the same font stack the frames
 * draw with. Without a DOM (server render) it falls back to an average-character estimate.
 */

export const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  return ctx;
}

/** Width in px of `text` at 100px, scaled. Cached per (text, weight). */
export function textWidth(text: string, size: number, weight: number = 600): number {
  const key = weight + "|" + text;
  let w100 = cache.get(key);
  if (w100 === undefined) {
    const c = context();
    if (c) {
      c.font = `${weight} 100px ${FONT}`;
      w100 = c.measureText(text).width;
    } else {
      w100 = text.length * (weight >= 700 ? 58 : 55);
    }
    cache.set(key, w100);
  }
  return (w100 * size) / 100;
}

/** Greedy word wrap with real measurement. Words are never split. */
export function wrap(text: string, boxW: number, size: number, weight = 600): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (cur && textWidth(next, size, weight) > boxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export type Fit = { size: number; lines: string[]; lineHeight: number; height: number; width: number };

/**
 * Largest font size (between min and max) where `text` wraps inside boxW x boxH, in at most maxLines lines.
 * The longest single word always fits the width, so nothing overflows sideways even at the minimum size.
 */
export function fitParagraph(
  text: string,
  o: { w: number; h: number; max: number; min?: number; weight?: number; lineHeight?: number; maxLines?: number },
): Fit {
  const weight = o.weight ?? 600;
  const lh = o.lineHeight ?? 1.2;
  const min = o.min ?? 14;
  const boxW = o.w * 0.97; // margin for rendering differences
  const words = text.split(/\s+/).filter(Boolean);
  const longest = Math.max(1, ...words.map((w) => textWidth(w, 100, weight))) / 100;
  let size = Math.max(min, Math.min(o.max, Math.floor(boxW / longest)));
  const make = (s: number): Fit => {
    const lines = wrap(text, boxW, s, weight);
    return { size: s, lines, lineHeight: lh, height: lines.length * s * lh, width: Math.max(0, ...lines.map((l) => textWidth(l, s, weight))) };
  };
  for (; size > min; size -= 2) {
    const f = make(size);
    if (f.height <= o.h && f.lines.length <= (o.maxLines ?? 99)) return f;
  }
  // Still too much text at the minimum: shrink below it rather than overflow (only reached by very long copy).
  for (size = min; size > 8; size -= 1) {
    const f = make(size);
    if (f.height <= o.h && f.lines.length <= (o.maxLines ?? 99)) return f;
  }
  return make(8);
}

/** Font size (<= max) for one line of text inside boxW. */
export function fitLine(text: string, boxW: number, max: number, weight = 600): number {
  const w = textWidth(text, 100, weight);
  if (w <= 0) return max;
  return Math.max(8, Math.min(max, Math.floor(((boxW * 0.97) / w) * 100)));
}
