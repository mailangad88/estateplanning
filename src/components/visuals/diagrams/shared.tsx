import type { ReactNode } from "react";
import { Card, Text, TextLines } from "../primitives";
import type { ColorName } from "../tokens";

/** Opacity for an element that belongs to step `n`. Undefined step shows everything. */
export function stepOp(step: number | undefined, n: number, dim = 0): number {
  return step === undefined || step >= n ? 1 : dim;
}

/** Group that appears at step `n` (hidden, or `dim` for context, before then). */
export function S({ step, n, dim = 0, children }: { step?: number; n: number; dim?: number; children: ReactNode }) {
  return <g opacity={stepOp(step, n, dim)}>{children}</g>;
}

/** Greedy word wrap using ~0.55 x fontSize per character. */
export function wrapLines(text: string, width: number, size: number, factor = 0.55): string[] {
  const max = Math.max(4, Math.floor(width / (size * factor)));
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > max) {
      out.push(line);
      line = word;
    } else line = line ? line + " " + word : word;
  }
  if (line) out.push(line);
  return out;
}

/** Wrapped text block that stays inside `w`. Baseline of the first line is `y`. */
export function Wrap({
  x,
  y,
  w,
  text,
  size = 15,
  weight = 400,
  color = "ink",
  anchor = "start",
  lh,
}: {
  x: number;
  y: number;
  w: number;
  text: string;
  size?: number;
  weight?: number;
  color?: ColorName;
  anchor?: "start" | "middle";
  lh?: number;
}) {
  return <TextLines lines={wrapLines(text, w, size)} x={x} y={y} size={size} weight={weight} color={color} anchor={anchor} lineHeight={lh ?? size * 1.3} />;
}

export const wrapCount = (text: string, w: number, size: number) => wrapLines(text, w, size).length;

/** Paper background plus the house headline and subhead. */
export function Frame({ w = 960, h, title, sub }: { w?: number; h: number; title: string; sub?: string }) {
  return (
    <>
      <Card x={0} y={0} w={w} h={h} fill="paper" border="none" r={0} />
      <Text x={40} y={56} size={28} weight={700}>
        {title}
      </Text>
      {sub ? (
        <Text x={40} y={86} size={16} color="muted">
          {sub}
        </Text>
      ) : null}
    </>
  );
}

/** Estimated pill width, matching the Pill primitive. */
export const pillW = (text: string, size = 13) => text.length * size * 0.58 + size * 1.6;
