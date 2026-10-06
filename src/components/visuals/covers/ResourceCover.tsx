import type { ReactNode } from "react";
import { firm } from "@/config/firm";
import { Figure } from "../Figure";
import { Icon } from "../icons/Icon";
import { Blob, Pill, Text } from "../primitives";
import { c, lineProps, type ColorName } from "../tokens";
import { fillOf } from "../illustrations/kit";
import { CalmMotifs, SideMotifs, type CoverFormat } from "./motifs";

export type CoverPalette = "accent" | "sage" | "clay" | "gold";

export type ResourceCoverProps = {
  title: string;
  subtitle?: string;
  /** Small label above the title, such as "Free checklist". */
  kicker?: string;
  /** Icon name from the house icon set. */
  icon: string;
  palette: CoverPalette;
  /** Quieter composition for sensitive topics: fewer shapes, softer colour. */
  calm?: boolean;
  /** Composition variant: decides the motif beside the icon. */
  format?: CoverFormat;
  bare?: boolean;
  caption?: ReactNode;
};

const palettes: Record<CoverPalette, { main: ColorName; tint: ColorName; deep: ColorName; second: ColorName; secondTint: ColorName }> = {
  accent: { main: "accent", tint: "accentTint", deep: "accentDeep", second: "clay", secondTint: "clayTint" },
  sage: { main: "sage", tint: "sageTint", deep: "sage", second: "accent", secondTint: "accentTint" },
  clay: { main: "clay", tint: "clayTint", deep: "clay", second: "accent", secondTint: "accentTint" },
  gold: { main: "gold", tint: "goldTint", deep: "gold", second: "accent", secondTint: "accentTint" },
};

/** Greedy word wrap by character budget. */
export function wrapText(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > maxChars) {
      out.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Word wrap that avoids a one-word widow on the last line when a narrower wrap keeps the same line count. */
export function balancedWrap(text: string, maxChars: number): string[] {
  const base = wrapText(text, maxChars);
  const last = base[base.length - 1] ?? "";
  if (base.length < 2 || last.length >= 7) return base;
  for (let m = maxChars - 1; m >= Math.ceil(maxChars * 0.7); m--) {
    const alt = wrapText(text, m);
    if (alt.length === base.length && (alt[alt.length - 1]?.length ?? 0) >= 7) return alt;
  }
  return base;
}

/**
 * Book or report style cover, portrait 600 x 800. Used for lead magnet
 * landing pages, emails and PDF cover pages.
 */
export function ResourceCover({ title, subtitle, kicker, icon, palette, calm, format = "default", bare, caption }: ResourceCoverProps) {
  const p = palettes[palette];
  // Pick the largest title size that fits in four lines.
  let size = 52;
  let lines = balancedWrap(title, Math.floor(488 / (size * 0.53)));
  while (lines.length > 4 && size > 36) {
    size -= 3;
    lines = balancedWrap(title, Math.floor(488 / (size * 0.53)));
  }
  const lh = size * 1.14;
  const titleTop = kicker ? 150 : 110;
  const titleBottom = titleTop + size + (lines.length - 1) * lh;
  // Subtitle lines must end above the art panel (y 430).
  const maxSub = Math.max(0, Math.min(3, Math.floor((404 - (titleBottom + 44)) / 29) + 1));
  const subWrapped = subtitle ? wrapText(subtitle, 34) : [];
  // Never cut a subtitle mid-phrase: if it does not fit above the panel, leave it out.
  const subLines = subWrapped.length <= Math.min(3, maxSub) ? subWrapped : [];
  const cx = 300;
  const cy = format === "email-course" ? 540 : 570;
  return (
    <Figure
      width={600}
      height={800}
      bare={bare}
      caption={caption}
      title={`${title}${kicker ? ` (${kicker})` : ""}`}
      desc={`Cover of a ${firm.brandName} resource titled "${title}"${subtitle ? `, ${subtitle}` : ""}. A ${palette} coloured cover with a ${icon} icon.`}
    >
      <rect width={600} height={800} style={fillOf("paper")} />
      <rect width={26} height={800} style={fillOf(p.main)} />
      <rect x={26} width={4} height={800} style={fillOf(p.tint)} />
      {kicker ? <Pill x={64} y={72} text={kicker.toUpperCase()} fill={p.tint} ink={palette === "accent" ? "accentDeep" : "ink"} size={14} /> : null}
      {lines.map((l, i) => (
        <Text key={i} x={64} y={titleTop + size + i * lh} size={size} weight={700} color="ink">
          {l}
        </Text>
      ))}
      {subLines.map((l, i) => (
        <Text key={i} x={64} y={titleBottom + 44 + i * 29} size={21} color="muted">
          {l}
        </Text>
      ))}
      <rect x={64} y={430} width={472} height={281} rx={28} style={fillOf(p.tint)} />
      {calm ? (
        <g>
          <circle cx={cx} cy={cy} r={86} style={fillOf("surface")} opacity={0.65} />
          <circle cx={cx} cy={cy} r={62} style={fillOf("surface")} />
          <Icon name={icon} size={64} x={cx - 32} y={cy - 32} color={p.deep} tint={p.tint} strokeWidth={1.8} />
          <CalmMotifs format={format} t={p} />
        </g>
      ) : (
        <g>
          <Blob cx={cx} cy={cy} r={118} color="surface" seed={palette.length} />
          <circle cx={cx} cy={cy} r={72} style={fillOf("surface")} />
          <circle cx={cx} cy={cy} r={72} style={{ fill: "none", stroke: c[p.main] }} strokeWidth={2} />
          <Icon name={icon} size={78} x={cx - 39} y={cy - 39} color={p.deep} tint={p.tint} />
          <SideMotifs format={format} t={p} />
        </g>
      )}
      <line x1={64} x2={536} y1={738} y2={738} style={{ stroke: c.line }} strokeWidth={2} {...lineProps} />
      <Text x={64} y={772} size={18} weight={700} color="muted">
        {firm.brandName}
      </Text>
    </Figure>
  );
}
