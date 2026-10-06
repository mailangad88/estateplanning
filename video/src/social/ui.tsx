import type { CSSProperties, ReactNode } from "react";
import { fitText, measureText } from "@remotion/layout-utils";
import { hex, type ColorName } from "../../../src/components/visuals/tokens";
import { SIcon } from "../visual/icons";
import { FONT } from "../visual/anim";
import { DISCLAIMER, FIRM, type Palette } from "./data";

export const colorOf = (n: ColorName) => hex[n];

const FF = "Inter";
const width = (text: string, fontSize: number, fontWeight: number | string) =>
  measureText({ text, fontFamily: FF, fontSize, fontWeight }).width;

/** Greedy word wrap using real text measurement. A word is never split. */
export function wrapWords(text: string, boxW: number, fontSize: number, weight: number | string = 500): string[][] {
  const lines: string[][] = [];
  let cur: string[] = [];
  const space = width(" ", fontSize, weight);
  let curW = 0;
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const ww = width(w, fontSize, weight);
    if (cur.length && curW + space + ww > boxW) {
      lines.push(cur);
      cur = [w];
      curW = ww;
    } else {
      curW = cur.length ? curW + space + ww : ww;
      cur.push(w);
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

export type Fit = { fontSize: number; lineHeight: number; lines: string[][]; height: number };
/** Largest font size (<= max) where the wrapped paragraph fits both the width and the height. */
export function fitParagraph(text: string, rawW: number, boxH: number, maxSize: number, minSize = 18, weight: number | string = 500, lh = 1.4): Fit {
  const boxW = rawW * 0.97; // safety margin for rendering differences
  const longest = Math.max(...text.split(/\s+/).map((w) => width(w, 100, weight))) / 100;
  let size = Math.min(maxSize, Math.floor(boxW / longest));
  for (; size >= minSize; size -= 1) {
    const lines = wrapWords(text, boxW, size, weight);
    if (lines.length * size * lh <= boxH) return { fontSize: size, lineHeight: lh, lines, height: lines.length * size * lh };
  }
  const lines = wrapWords(text, boxW, minSize, weight);
  return { fontSize: minSize, lineHeight: lh, lines, height: lines.length * minSize * lh };
}

/** One-line text that shrinks (via fitText) to the box width. */
export function OneLine({ text, boxW, maxSize, weight = 700, color = hex.ink, style }: { text: string; boxW: number; maxSize: number; weight?: number; color?: string; style?: CSSProperties }) {
  const { fontSize } = fitText({ text, withinWidth: boxW, fontFamily: FF, fontWeight: weight });
  const size = Math.min(maxSize, fontSize);
  return <div style={{ fontFamily: FONT, fontSize: size, fontWeight: weight, color, whiteSpace: "nowrap", lineHeight: 1.1, ...style }}>{text}</div>;
}

export type ParaWord = { opacity?: number; bg?: string; color?: string };
/** Renders wrapped lines explicitly so what was measured is what is drawn. Optional per-word style. */
export function Paragraph({ fit, weight = 500, color = hex.ink, align = "left", wordStyle }: { fit: Fit; weight?: number; color?: string; align?: "left" | "center"; wordStyle?: (i: number) => ParaWord | undefined }) {
  let idx = 0;
  return (
    <div style={{ fontFamily: FONT, fontSize: fit.fontSize, lineHeight: fit.lineHeight, fontWeight: weight, color, textAlign: align }}>
      {fit.lines.map((line, li) => (
        <div key={li} style={{ whiteSpace: "nowrap", height: fit.fontSize * fit.lineHeight, display: "flex", justifyContent: align === "center" ? "center" : "flex-start", flexWrap: "nowrap" }}>
          {line.map((w, wi) => {
            const st = wordStyle?.(idx++);
            return (
              <span key={wi} style={{ opacity: st?.opacity ?? 1, color: st?.color, background: st?.bg, borderRadius: fit.fontSize * 0.2, padding: st?.bg ? `0 ${fit.fontSize * 0.12}px` : 0, marginLeft: st?.bg ? -fit.fontSize * 0.12 : 0, marginRight: wi < line.length - 1 ? fit.fontSize * 0.27 - (st?.bg ? fit.fontSize * 0.12 : 0) : st?.bg ? -fit.fontSize * 0.12 : 0 }}>{w}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Glyph({ name, size, color = "accent", tint = "accentTint", strokeWidth = 1.8 }: { name: string; size: number; color?: ColorName; tint?: ColorName | "none"; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
      <SIcon name={name} size={24} color={color} tint={tint} strokeWidth={strokeWidth} />
    </svg>
  );
}

export function IconTile({ icon, size, p, radius }: { icon: string; size: number; p: Palette; radius?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius ?? size * 0.28, background: hex[p.tint], display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${hex.surface}`, boxShadow: "0 10px 28px rgba(29,43,58,0.10)" }}>
      <Glyph name={icon} size={size * 0.58} color={p.main === "gold" ? "clay" : p.main} tint="surface" />
    </div>
  );
}

export function Wordmark({ size = 30, color = hex.ink }: { size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.45, fontFamily: FONT, fontWeight: 700, fontSize: size, color, letterSpacing: "-0.005em" }}>
      <svg width={size * 1.5} height={size * 1.5} viewBox="0 0 36 36">
        <rect width="36" height="36" rx="10" fill={hex.accent} />
        <SIcon name="scale" x={6} y={6} size={24} color="surface" tint="none" strokeWidth={2.2} />
      </svg>
      <span>{FIRM}</span>
    </div>
  );
}

export function Kicker({ text, size = 24, color = hex.accent }: { text: string; size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.6, fontFamily: FONT, fontSize: size, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color }}>
      <span style={{ width: size * 1.6, height: 4, borderRadius: 2, background: color, display: "block" }} />
      {text}
    </div>
  );
}

export function Pill({ children, bg, color, size = 22, weight = 600, style }: { children: ReactNode; bg: string; color: string; size?: number; weight?: number; style?: CSSProperties }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: FONT, fontSize: size, fontWeight: weight, color, background: bg, padding: `${size * 0.42}px ${size * 0.95}px`, borderRadius: 999, whiteSpace: "nowrap", ...style }}>{children}</div>
  );
}

/** Soft paper backdrop with a few quiet shapes. `variant` shifts them so cards do not all look identical. */
export function Backdrop({ w, h, p, seed = 0 }: { w: number; h: number; p: Palette; seed?: number }) {
  const flip = seed % 2 === 1;
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      <rect width={w} height={h} fill={hex.paper} />
      <circle cx={flip ? w * 0.08 : w * 0.95} cy={h * 0.06} r={Math.min(w, h) * 0.34} fill={hex[p.tint]} opacity={0.7} />
      <circle cx={flip ? w * 0.96 : w * 0.02} cy={h * 0.98} r={Math.min(w, h) * 0.26} fill={hex.sand} opacity={0.8} />
      <circle cx={flip ? w * 0.84 : w * 0.16} cy={h * 0.9} r={Math.min(w, h) * 0.05} fill={hex.sageTint} />
      <circle cx={flip ? w * 0.7 : w * 0.92} cy={h * 0.965} r={Math.min(w, h) * 0.022} fill={hex.goldTint} />
    </svg>
  );
}

export function Footer({ boxW, size = 22, align = "left", color = hex.muted }: { boxW: number; size?: number; align?: "left" | "center"; color?: string }) {
  const { fontSize } = fitText({ text: DISCLAIMER, withinWidth: boxW, fontFamily: FF, fontWeight: 500 });
  return (
    <div style={{ fontFamily: FONT, fontSize: Math.min(size, fontSize), fontWeight: 500, color, whiteSpace: "nowrap", textAlign: align, width: boxW }}>{DISCLAIMER}</div>
  );
}

export const card: CSSProperties = {
  background: hex.surface,
  border: `2px solid ${hex.line}`,
  boxShadow: "0 14px 40px rgba(29,43,58,0.07)",
};
