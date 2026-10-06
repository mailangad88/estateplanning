/**
 * Small scene pieces shared by the hero and spot illustrations. Everything is
 * flat SVG built from the house tokens, so it follows light and dark mode.
 */
import type { ReactNode } from "react";
import { c, lineProps, stroke, type ColorName } from "../tokens";
import { Icon } from "../icons/Icon";

export const fillOf = (k: ColorName) => ({ fill: c[k] });

/** Paper background, one big soft disc and a gently rolling ground band. */
export function Backdrop({
  w = 1200,
  h = 720,
  tint = "accentTint",
  cx = w / 2,
  cy = h * 0.46,
  r = 300,
  ground = "sand",
  groundY = h - 110,
}: {
  w?: number;
  h?: number;
  tint?: ColorName;
  cx?: number;
  cy?: number;
  r?: number;
  ground?: ColorName | "none";
  groundY?: number;
}) {
  return (
    <g>
      <rect width={w} height={h} style={fillOf("paper")} />
      <circle cx={cx} cy={cy} r={r} style={fillOf(tint)} />
      {ground !== "none" ? (
        <path
          d={`M 0 ${groundY} Q ${w * 0.25} ${groundY - 34} ${w * 0.5} ${groundY - 8} T ${w} ${groundY - 14} V ${h} H 0 Z`}
          style={fillOf(ground)}
        />
      ) : null}
    </g>
  );
}

export function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} style={fillOf("surface")}>
      <rect x={-60} y={-10} width={120} height={32} rx={16} />
      <circle cx={-12} cy={-14} r={22} />
      <circle cx={22} cy={-8} r={16} />
    </g>
  );
}

export function Sun({ x, y, r = 44 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 1.6} style={fillOf("goldTint")} />
      <circle cx={x} cy={y} r={r} style={fillOf("gold")} />
    </g>
  );
}

/** A simple house; (x, y) is bottom centre. */
export function House({
  x,
  y,
  w = 360,
  wall = "surface",
  roof = "accent",
  door = "clay",
  windows = true,
}: {
  x: number;
  y: number;
  w?: number;
  wall?: ColorName;
  roof?: ColorName;
  door?: ColorName;
  windows?: boolean;
}) {
  const h = w * 0.62;
  const left = x - w / 2;
  const top = y - h;
  const rise = w * 0.3;
  const dw = w * 0.15;
  const dh = h * 0.52;
  const ww = w * 0.17;
  return (
    <g>
      <rect x={x + w * 0.2} y={top - rise * 0.55} width={w * 0.07} height={rise * 0.8} rx={3} style={fillOf("accentDeep")} />
      <rect x={left} y={top} width={w} height={h} rx={10} style={{ fill: c[wall], stroke: c.line }} strokeWidth={stroke.base} />
      <path
        d={`M ${left - w * 0.05} ${top + 6} L ${x} ${top - rise} L ${left + w + w * 0.05} ${top + 6} Z`}
        style={{ fill: c[roof], stroke: c[roof] }}
        strokeWidth={14}
        {...lineProps}
      />
      <rect x={x - dw / 2} y={y - dh} width={dw} height={dh} rx={dw / 2} ry={dw / 2} style={fillOf(door)} />
      <rect x={x - dw / 2} y={y - dh + dw / 2} width={dw} height={dh - dw / 2} style={fillOf(door)} />
      <circle cx={x + dw * 0.24} cy={y - dh * 0.42} r={3.5} style={fillOf("goldTint")} />
      {windows ? (
        <>
          <rect x={left + w * 0.12} y={top + h * 0.2} width={ww} height={ww} rx={6} style={fillOf("accentTint")} />
          <rect x={left + w - w * 0.12 - ww} y={top + h * 0.2} width={ww} height={ww} rx={6} style={fillOf("accentTint")} />
          <rect x={left + w * 0.12} y={top + h * 0.2 + ww / 2 - 1} width={ww} height={2} style={fillOf("surface")} />
          <rect x={left + w - w * 0.12 - ww} y={top + h * 0.2 + ww / 2 - 1} width={ww} height={2} style={fillOf("surface")} />
        </>
      ) : null}
    </g>
  );
}

export function shieldPath(s: number) {
  return `M 0 ${-s} L ${-s * 0.82} ${-s * 0.66} V ${s * 0.05} C ${-s * 0.82} ${s * 0.6} ${-s * 0.42} ${s * 0.92} 0 ${s * 1.1} C ${s * 0.42} ${s * 0.92} ${s * 0.82} ${s * 0.6} ${s * 0.82} ${s * 0.05} V ${-s * 0.66} Z`;
}

/** Shield centred at (x, y); radius-like size `s`. */
export function Shield({
  x,
  y,
  s = 60,
  fill = "accent",
  ink = "surface",
  check = true,
}: {
  x: number;
  y: number;
  s?: number;
  fill?: ColorName;
  ink?: ColorName;
  check?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={shieldPath(s)} style={{ fill: c[fill], stroke: c[fill] }} strokeWidth={8} {...lineProps} />
      {check ? (
        <path
          d={`M ${-s * 0.34} ${s * 0.02} L ${-s * 0.08} ${s * 0.3} L ${s * 0.38} ${-s * 0.28}`}
          style={{ fill: "none", stroke: c[ink] }}
          strokeWidth={Math.max(5, s * 0.12)}
          {...lineProps}
        />
      ) : null}
    </g>
  );
}

export function Tree({ x, y, s = 1, color = "sage" }: { x: number; y: number; s?: number; color?: ColorName }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-7} y={-70} width={14} height={70} rx={5} style={fillOf("sandDeep")} />
      <circle cx={0} cy={-110} r={50} style={fillOf(color)} />
      <circle cx={-34} cy={-84} r={30} style={fillOf(color)} />
      <circle cx={34} cy={-86} r={32} style={fillOf(color)} />
    </g>
  );
}

export function Sprout({ x, y, s = 1, color = "sage" }: { x: number; y: number; s?: number; color?: ColorName }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M 0 0 V -46" style={{ stroke: c[color], fill: "none" }} strokeWidth={4} {...lineProps} />
      <path d="M 0 -30 C -30 -30 -34 -56 -34 -56 C -8 -58 0 -44 0 -30 Z" style={fillOf(color)} />
      <path d="M 0 -42 C 28 -42 32 -70 32 -70 C 6 -72 0 -58 0 -42 Z" style={fillOf(color)} />
    </g>
  );
}

/** Pot with a sprout; (x, y) bottom centre. */
export function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Sprout x={0} y={-34} s={1.2} />
      <path d="M -26 -36 H 26 L 20 0 H -20 Z" style={fillOf("clay")} />
      <rect x={-30} y={-42} width={60} height={12} rx={6} style={fillOf("clay")} />
    </g>
  );
}

/** Circle badge holding an icon. */
export function IconDisc({
  x,
  y,
  r = 36,
  name,
  color = "accent",
  fill = "surface",
  tint = "accentTint",
  ring = true,
}: {
  x: number;
  y: number;
  r?: number;
  name: string;
  color?: ColorName;
  fill?: ColorName;
  tint?: ColorName;
  ring?: boolean;
}) {
  const size = r * 1.1;
  return (
    <g>
      <circle cx={x} cy={y} r={r} style={{ fill: c[fill], stroke: ring ? c[color] : "none" }} strokeWidth={stroke.base} />
      <Icon name={name} size={size} x={x - size / 2} y={y - size / 2} color={color} tint={tint} />
    </g>
  );
}

/** A handwritten-looking signature squiggle starting at (x, y). */
export function Signature({ x, y, w = 110, color = "accent" }: { x: number; y: number; w?: number; color?: ColorName }) {
  const k = w / 110;
  return (
    <path
      transform={`translate(${x} ${y}) scale(${k})`}
      d="M 0 0 C 8 -22 18 -26 16 -6 C 14 12 26 -14 34 -12 C 40 -10 34 6 42 4 C 52 2 56 -10 62 -4 C 68 2 78 2 110 -6"
      style={{ fill: "none", stroke: c[color] }}
      strokeWidth={3.5}
      {...lineProps}
    />
  );
}

/** Round wax-style seal with a check. */
export function Seal({ x, y, r = 24, color = "gold" }: { x: number; y: number; r?: number; color?: ColorName }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} style={fillOf(color)} />
      <circle cx={x} cy={y} r={r * 0.72} style={{ fill: "none", stroke: c.surface }} strokeWidth={2} />
      <path
        d={`M ${x - r * 0.3} ${y + r * 0.02} L ${x - r * 0.06} ${y + r * 0.28} L ${x + r * 0.34} ${y - r * 0.24}`}
        style={{ fill: "none", stroke: c.surface }}
        strokeWidth={3}
        {...lineProps}
      />
    </g>
  );
}

/** A big paper page with a few quiet lines; (x, y) top-left. */
export function Page({
  x,
  y,
  w,
  h,
  title,
  children,
  accent = "accent",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  children?: ReactNode;
  accent?: ColorName;
}) {
  return (
    <g>
      <rect x={x + 8} y={y + 10} width={w} height={h} rx={14} style={fillOf("sandDeep")} opacity={0.45} />
      <rect x={x} y={y} width={w} height={h} rx={14} style={{ fill: c.surface, stroke: c.line }} strokeWidth={stroke.base} />
      <rect x={x} y={y} width={w} height={h * 0.045 + 6} rx={3} style={fillOf(accent)} opacity={0} />
      {title ? (
        <text
          x={x + w / 2}
          y={y + h * 0.13}
          textAnchor="middle"
          fontSize={Math.max(14, w * 0.075)}
          fontWeight={700}
          letterSpacing={1.2}
          style={{ fill: c[accent], fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}
        >
          {title}
        </text>
      ) : null}
      {children}
    </g>
  );
}

/** Quiet grey placeholder lines. */
export function Lines({ x, y, w, n = 3, gap = 18, short = 0.6 }: { x: number; y: number; w: number; n?: number; gap?: number; short?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <line
          key={i}
          x1={x}
          x2={x + (i === n - 1 ? w * short : w)}
          y1={y + i * gap}
          y2={y + i * gap}
          style={{ stroke: c.line }}
          strokeWidth={stroke.base + 1}
          {...lineProps}
        />
      ))}
    </g>
  );
}

/** Cane for an older person standing at (x, y) base. */
export function Cane({ x, y, h = 90 }: { x: number; y: number; h?: number }) {
  return (
    <path
      d={`M ${x} ${y} V ${y - h} q 0 -14 14 -14 q 12 0 12 12`}
      style={{ fill: "none", stroke: c.clay }}
      strokeWidth={5}
      {...lineProps}
    />
  );
}
