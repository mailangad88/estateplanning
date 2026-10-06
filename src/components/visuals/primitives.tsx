/**
 * Drawing primitives shared by diagrams, illustrations, covers and video
 * scenes. Everything is plain SVG with no Next.js imports, so the same
 * pieces render in the site, in Remotion and in static exports.
 */
import type { ReactNode, SVGProps } from "react";
import { c, font, lineProps, radius, stroke, type ColorName } from "./tokens";

type Pos = { x: number; y: number };

/** Faceless person: circle head, rounded shoulders. Never a depiction of a real person. */
export function Person({
  x,
  y,
  size = 48,
  color = "accent",
  child = false,
}: Pos & { size?: number; color?: ColorName; child?: boolean }) {
  const s = child ? size * 0.72 : size;
  const head = s * 0.22;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx={0} cy={-s * 0.62} r={head} style={{ fill: c[color] }} />
      <path
        d={`M ${-s * 0.36} 0 Q ${-s * 0.36} ${-s * 0.36} 0 ${-s * 0.36} Q ${s * 0.36} ${-s * 0.36} ${s * 0.36} 0 Z`}
        style={{ fill: c[color] }}
      />
    </g>
  );
}

/** A paper document with a folded corner and text lines. (x, y) is the top-left corner. */
export function Doc({
  x,
  y,
  w = 64,
  h = 82,
  label,
  tone = "surface",
  ink = "accent",
}: Pos & { w?: number; h?: number; label?: string; tone?: ColorName; ink?: ColorName }) {
  const fold = Math.min(w, h) * 0.22;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={`M 0 ${radius.sm} Q 0 0 ${radius.sm} 0 H ${w - fold} L ${w} ${fold} V ${h - radius.sm} Q ${w} ${h} ${w - radius.sm} ${h} H ${radius.sm} Q 0 ${h} 0 ${h - radius.sm} Z`}
        style={{ fill: c[tone], stroke: c[ink] }}
        strokeWidth={stroke.base}
        {...lineProps}
      />
      <path d={`M ${w - fold} 0 V ${fold} H ${w}`} style={{ fill: "none", stroke: c[ink] }} strokeWidth={stroke.base} {...lineProps} />
      {[0.38, 0.52, 0.66].map((f, i) => (
        <line
          key={i}
          x1={w * 0.18}
          x2={i === 2 ? w * 0.6 : w * 0.82}
          y1={h * f}
          y2={h * f}
          style={{ stroke: c.line }}
          strokeWidth={stroke.base}
          {...lineProps}
        />
      ))}
      {label ? (
        <Text x={w / 2} y={h * 0.24} size={Math.max(10, w * 0.16)} weight={700} color={ink} anchor="middle">
          {label}
        </Text>
      ) : null}
    </g>
  );
}

/** Rounded card. */
export function Card({
  x,
  y,
  w,
  h,
  fill = "surface",
  border = "line",
  r = radius.md,
  dashed,
}: Pos & { w: number; h: number; fill?: ColorName; border?: ColorName | "none"; r?: number; dashed?: boolean }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={r}
      style={{ fill: c[fill], stroke: border === "none" ? "none" : c[border] }}
      strokeWidth={stroke.base}
      strokeDasharray={dashed ? "6 6" : undefined}
    />
  );
}

/** Text in the house type style. Use \n-free strings; wrap with <TextLines> for multiple lines. */
export function Text({
  x,
  y,
  size = 16,
  weight = font.body,
  color = "ink",
  anchor = "start",
  children,
  ...rest
}: Pos & {
  size?: number;
  weight?: number;
  color?: ColorName;
  anchor?: "start" | "middle" | "end";
  children: ReactNode;
} & Omit<SVGProps<SVGTextElement>, "x" | "y" | "color">) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      style={{ fill: c[color], fontFamily: font.family }}
      {...rest}
    >
      {children}
    </text>
  );
}

/** Several lines of text, each `lineHeight` apart. */
export function TextLines({
  lines,
  lineHeight,
  ...props
}: { lines: string[]; lineHeight?: number } & Omit<Parameters<typeof Text>[0], "children">) {
  const lh = lineHeight ?? (props.size ?? 16) * 1.3;
  return (
    <>
      {lines.map((l, i) => (
        <Text key={i} {...props} y={props.y + i * lh}>
          {l}
        </Text>
      ))}
    </>
  );
}

/** Arrow from one point to another with a rounded chevron head. Optional curve via `bend`. */
export function Arrow({
  from,
  to,
  color = "accent",
  bend = 0,
  dashed,
  width = stroke.base,
  head = 9,
}: {
  from: Pos;
  to: Pos;
  color?: ColorName;
  bend?: number;
  dashed?: boolean;
  width?: number;
  head?: number;
}) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * bend;
  const cy = my + (dx / len) * bend;
  const ang = Math.atan2(to.y - cy, to.x - cx);
  const a1 = ang + Math.PI * 0.8;
  const a2 = ang - Math.PI * 0.8;
  return (
    <g style={{ stroke: c[color], fill: "none" }} strokeWidth={width} {...lineProps}>
      <path d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`} strokeDasharray={dashed ? "6 7" : undefined} />
      <path
        d={`M ${to.x + Math.cos(a1) * head} ${to.y + Math.sin(a1) * head} L ${to.x} ${to.y} L ${to.x + Math.cos(a2) * head} ${to.y + Math.sin(a2) * head}`}
      />
    </g>
  );
}

/** Numbered circle badge, for steps. */
export function Badge({ x, y, n, r = 16, color = "accent" }: Pos & { n: number | string; r?: number; color?: ColorName }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} style={{ fill: c[color] }} />
      <Text x={x} y={y + r * 0.36} size={r} weight={700} color="surface" anchor="middle">
        {n}
      </Text>
    </g>
  );
}

/** Pill-shaped label. */
export function Pill({
  x,
  y,
  text,
  fill = "accentTint",
  ink = "accentDeep",
  size = 13,
  anchor = "start",
}: Pos & { text: string; fill?: ColorName; ink?: ColorName; size?: number; anchor?: "start" | "middle" }) {
  const w = text.length * size * 0.58 + size * 1.6;
  const h = size * 2;
  const left = anchor === "middle" ? x - w / 2 : x;
  return (
    <g>
      <rect x={left} y={y} width={w} height={h} rx={h / 2} style={{ fill: c[fill] }} />
      <Text x={left + w / 2} y={y + h * 0.66} size={size} weight={600} color={ink} anchor="middle">
        {text}
      </Text>
    </g>
  );
}

/** Soft organic blob used behind spot illustrations. */
export function Blob({ cx, cy, r, color = "sand", seed = 0 }: { cx: number; cy: number; r: number; color?: ColorName; seed?: number }) {
  const pts = 8;
  const coords = Array.from({ length: pts }, (_, i) => {
    const a = (i / pts) * Math.PI * 2;
    const wobble = 1 + 0.08 * Math.sin(i * 2.3 + seed) + 0.05 * Math.cos(i * 1.7 + seed * 2);
    return [cx + Math.cos(a) * r * wobble, cy + Math.sin(a) * r * wobble * 0.86];
  });
  const mid = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = "";
  coords.forEach((p, i) => {
    const q = coords[(i + 1) % pts];
    const m = mid(p, q);
    if (i === 0) {
      const start = mid(coords[pts - 1], p);
      d += `M ${start[0].toFixed(1)} ${start[1].toFixed(1)} `;
    }
    d += `Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)} `;
  });
  return <path d={d + "Z"} style={{ fill: c[color] }} />;
}
