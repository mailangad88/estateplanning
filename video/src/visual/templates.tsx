import type { ReactNode } from "react";
import { interpolate } from "remotion";
import { Arrow, Card, Text } from "../../../src/components/visuals/primitives";
import { c, hex, type ColorName } from "../../../src/components/visuals/tokens";
import { SIcon } from "./icons";
import { stepTimes, textWidth, useScene, wrapLabel } from "./anim";

export type Tone = "accent" | "sage" | "clay" | "gold" | "muted";
export const toneMap: Record<Tone, { color: ColorName; tint: ColorName; ink: ColorName }> = {
  accent: { color: "accent", tint: "accentTint", ink: "accentDeep" },
  sage: { color: "sage", tint: "sageTint", ink: "ink" },
  clay: { color: "clay", tint: "clayTint", ink: "ink" },
  gold: { color: "gold", tint: "goldTint", ink: "ink" },
  muted: { color: "muted", tint: "sand", ink: "muted" },
};

export type Item = {
  icon: string; label?: string; tag?: string; tags?: string[]; tagTone?: Tone; tone?: Tone;
  dim?: boolean; strike?: boolean; blank?: boolean; badge?: string; noArrow?: boolean; highlight?: boolean;
};

export type Spec =
  | { k: "row"; items: Item[]; check?: boolean; arrows?: boolean; active?: number; cols?: number }
  | { k: "flow"; from: Item[]; to: Item[]; label?: string }
  | { k: "ladder"; rows: { label: string; icon?: string }[] }
  | { k: "timeline"; ticks: { at: number; label: string; icon?: string }[]; bars?: { from: number; to: number; label: string; tone?: Tone }[]; zones?: { from: number; to: number; label: string }[] }
  | { k: "compare"; left: Panel; right: Panel }
  | { k: "bars"; bars: Bar[]; line?: { value: number; label: string }; chips?: Chip[]; arrow?: boolean }
  | { k: "calendar"; days?: number; unit?: string; ranges: { from: number; to: number; label: string }[]; items?: Item[]; check?: boolean };
type Panel = { title: string; icon?: string; tone?: Tone; lines: string[] };
type Bar = { label: string; value: number; tone?: Tone; note?: string; ghost?: number; icon?: string };
type Chip = { text: string; icon?: string; x: number; y: number };

/* ---------- small pieces ---------- */

export function TagPill({ x, y, text, size = 16, tone = "accent", op = 1 }: { x: number; y: number; text: string; size?: number; tone?: Tone; op?: number }) {
  const t = toneMap[tone];
  const w = textWidth(text, size, 600) + size * 1.4;
  const h = size * 1.9;
  return (
    <g opacity={op}>
      <rect x={x - w / 2} y={y} width={w} height={h} rx={h / 2} style={{ fill: c[t.tint] }} />
      <Text x={x} y={y + h * 0.67} size={size} weight={600} color={t.ink} anchor="middle">{text}</Text>
    </g>
  );
}

function CheckBadge({ x, y, p }: { x: number; y: number; p: number }) {
  if (p <= 0) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${0.6 + 0.4 * p})`} opacity={p}>
      <circle r={16} style={{ fill: c.sage }} />
      <SIcon name="check" x={-9} y={-9} size={18} color="surface" tint="none" strokeWidth={3} />
    </g>
  );
}

function CompactCell({ cx, cy, w, h, item, p, dimP, vertical }: { cx: number; cy: number; w: number; h: number; item: Item; p: number; dimP: number; vertical: boolean }) {
  const it = toneMap[item.strike ? "muted" : item.tone ?? "accent"];
  const icon = Math.min(64, h - 24);
  const left = cx - w / 2 + 20;
  const tx = left + icon + 18;
  const lab = wrapLabel(item.label ?? "", w - icon - 70, vertical ? 24 : 24, 2);
  const lh = lab.size * 1.2;
  const ty = cy - (lab.lines.length * lh) / 2 + lab.size * 0.9 - (item.tag ? 8 : 0);
  return (
    <g opacity={p * (1 - 0.6 * dimP)} transform={`translate(0 ${(1 - p) * 12})`}>
      <Card x={cx - w / 2} y={cy - h / 2} w={w} h={h} r={16} border={item.highlight ? "accent" : "line"} />
      <SIcon name={item.icon} x={left} y={cy - icon / 2} size={icon} color={it.color} tint={it.tint} strokeWidth={1.8} />
      {lab.lines.map((l, i) => <Text key={i} x={tx} y={ty + i * lh} size={lab.size} weight={600}>{l}</Text>)}
      {item.tag && <TagPill x={tx + textWidth(item.tag, 15) / 2 + 11} y={ty + lab.lines.length * lh - lab.size * 0.5} text={item.tag} size={15} tone={item.tagTone ?? "accent"} />}
    </g>
  );
}

/** Icon + label (+ tags) on a soft card. (cx, cy) is the card centre. */
export function Cell({
  cx, cy, w, h, item, p = 1, dimP = 0, checkP = 0, active = false, vertical,
}: { cx: number; cy: number; w: number; h: number; item: Item; p?: number; dimP?: number; checkP?: number; active?: boolean; vertical: boolean }) {
  if (h < 128 && w > 200) return <CompactCell cx={cx} cy={cy} w={w} h={h} item={item} p={p} dimP={dimP} vertical={vertical} />;
  const labelMax = vertical ? 26 : 25;
  const maxIcon = 112;
  const tags = item.tags ?? (item.tag ? [item.tag] : []);
  const tagSize = vertical ? 17 : 16;
  const lab = item.label ? wrapLabel(item.label, w - 28, labelMax, 2) : null;
  const lh = lab ? lab.size * 1.25 : 0;
  const tagH = tags.length * (tagSize * 1.9 + 6);
  const reserve = (lab ? lab.lines.length * lh + 10 : 0) + (tags.length ? tagH + 4 : 0);
  const icon = item.blank ? 0 : Math.max(28, Math.min(maxIcon, w * 0.5, h - reserve - 28));
  const total = icon + (icon && lab ? 12 : 0) + reserve - (lab ? 10 : 0) * (icon ? 0 : 0);
  let y0 = cy - total / 2;
  const opacity = p * (1 - 0.6 * dimP) * (item.dim && dimP === 0 ? 0.4 : 1);
  const dy = (1 - p) * 14;
  const sc = 0.95 + 0.05 * p;
  const edge: ColorName = active || item.highlight ? "accent" : "line";
  const iconTone = item.strike ? "muted" : item.tone ?? "accent";
  const it = toneMap[iconTone];
  return (
    <g opacity={opacity} transform={`translate(${cx} ${cy + dy}) scale(${sc}) translate(${-cx} ${-cy})`}>
      <Card x={cx - w / 2} y={cy - h / 2} w={w} h={h} fill={active || item.highlight ? "accentTint" : "surface"} border={edge} dashed={item.blank} r={18} />
      {icon > 0 && <SIcon name={item.icon} x={cx - icon / 2} y={y0} size={icon} color={it.color} tint={it.tint} strokeWidth={1.8} />}
      {item.badge && icon > 0 && (
        <g>
          <circle cx={cx + icon / 2 + 2} cy={y0 + 4} r={15} style={{ fill: c.surface, stroke: c.line }} strokeWidth={2} />
          <SIcon name={item.badge} x={cx + icon / 2 - 8} y={y0 - 6} size={20} color="accent" tint="none" />
        </g>
      )}
      {lab && (() => {
        const ly = y0 + icon + (icon ? 12 : 0) + lab.size * 0.95;
        y0 = ly - lab.size * 0.95 + lab.lines.length * lh + 10;
        return (
          <>
            {lab.lines.map((l, i) => (
              <Text key={i} x={cx} y={ly + i * lh} size={lab.size} weight={600} color={item.strike || item.blank ? "muted" : "ink"} anchor="middle">{l}</Text>
            ))}
            {item.strike && (
              <rect x={cx - w * 0.36} y={ly - lab.size * 0.3} width={w * 0.72 * Math.min(1, p)} height={2.5} rx={1.25} style={{ fill: c.muted }} opacity={0.8} />
            )}
          </>
        );
      })()}
      {tags.map((t, i) => (
        <TagPill key={i} x={cx} y={y0 + i * (tagSize * 1.9 + 6)} text={t} size={tagSize} tone={item.tagTone ?? (item.strike || item.dim ? "muted" : "accent")} />
      ))}
      <CheckBadge x={cx + w / 2 - 10} y={cy - h / 2 + 10} p={checkP} />
    </g>
  );
}

/* ---------- Row of cells ---------- */

function gridFor(n: number, vertical: boolean, arrows: boolean, cols?: number) {
  if (cols) return cols;
  if (vertical) return arrows ? 1 : n <= 2 ? n : 2;
  return n <= 4 ? n : n === 5 ? 5 : 3;
}

export function RowCells({
  items, w, h, check, arrows, active, startAt = 0.5, gapX = 28, cols: colsIn,
}: { items: Item[]; w: number; h: number; check?: boolean; arrows?: boolean; active?: number; startAt?: number; gapX?: number; cols?: number }) {
  const { rv, dur, vertical } = useScene();
  const n = items.length;
  const cols = gridFor(n, vertical, !!arrows, colsIn);
  const rows = Math.ceil(n / cols);
  const gx = arrows && !vertical ? 64 : gapX;
  const gy = arrows && vertical ? 52 : 20;
  const cw = Math.min(n === 1 ? 340 : 300, (w - gx * (cols - 1)) / cols);
  const ch = Math.min(n === 1 ? 260 : 270, (h - gy * (rows - 1)) / rows);
  const at = stepTimes(n, dur, startAt);
  const pos = (i: number) => {
    const r = Math.floor(i / cols), k = Math.min(cols, n - r * cols), ci = i - r * cols;
    const rowW = k * cw + (k - 1) * gx;
    return { x: (w - rowW) / 2 + ci * (cw + gx) + cw / 2, y: (h - (rows * ch + (rows - 1) * gy)) / 2 + r * (ch + gy) + ch / 2 };
  };
  return (
    <g>
      {items.map((it, i) => {
        const { x, y } = pos(i);
        const showAt = check ? startAt + i * 0.25 : at(i);
        const p = rv(showAt);
        const checkAt = check ? at(i) + 0.9 : 0;
        return <Cell key={i} cx={x} cy={y} w={cw} h={ch} item={it} p={p} dimP={it.dim ? rv(showAt + 1.0) : 0}
          checkP={check ? rv(checkAt, 0.5) : 0} active={active === i} vertical={vertical} />;
      })}
      {arrows && items.slice(0, -1).map((it, i) => {
        const a = pos(i), b = pos(i + 1);
        const p = rv(at(i + 1) - 0.1, 0.7);
        if (p <= 0 || items[i + 1].noArrow) return null;
        const from = vertical ? { x: a.x, y: a.y + ch / 2 + 8 } : { x: a.x + cw / 2 + 8, y: a.y };
        const to = vertical ? { x: b.x, y: b.y - ch / 2 - 8 } : { x: b.x - cw / 2 - 8, y: b.y };
        const lerp = { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p };
        return <g key={"a" + i} opacity={p}><Arrow from={from} to={lerp} color="accent" width={3} head={10} /></g>;
      })}
    </g>
  );
}

/* ---------- Flow: sources -> targets ---------- */

export function Flow({ from, to, label, w, h }: { from: Item[]; to: Item[]; label?: string; w: number; h: number }) {
  const { rv, dur, vertical } = useScene();
  const colItem = (items: Item[], axis: number) => {
    const k = items.length;
    if (!vertical) {
      const ch = Math.min(250, (h - 18 * (k - 1)) / k);
      const cw = Math.min(300, w * 0.28);
      return items.map((_, i) => ({ x: axis < 0 ? cw / 2 : w - cw / 2, y: h / 2 + (i - (k - 1) / 2) * (ch + 18), w: cw, h: ch }));
    }
    const cw = Math.min(280, (w - 20 * (k - 1)) / k);
    const ch = Math.min(180, (h - 90) / 2);
    return items.map((_, i) => ({ x: w / 2 + (i - (k - 1) / 2) * (cw + 20), y: axis < 0 ? ch / 2 : h - ch / 2, w: cw, h: ch }));
  };
  const A = colItem(from, -1), B = colItem(to, 1);
  const t0 = 0.5, step = Math.min(1.5, (dur - 3.2) / Math.max(1, from.length + to.length));
  const aT = (i: number) => t0 + i * step;
  const bT = (i: number) => t0 + (from.length + i) * step + 0.4;
  const pairs: [number, number][] = [];
  if (from.length === 1) to.forEach((_, j) => pairs.push([0, j]));
  else if (to.length === 1) from.forEach((_, i) => pairs.push([i, 0]));
  else from.forEach((_, i) => pairs.push([i, Math.min(i, to.length - 1)]));
  return (
    <g>
      {label && <g opacity={rv(bT(0) - 0.2)}><TagPill x={vertical ? Math.min(w - textWidth(label, 18) / 2 - 20, w / 2 + textWidth(label, 18) / 2 + 30) : w / 2} y={h / 2 - 14} text={label} size={18} tone="accent" /></g>}
      {pairs.map(([i, j], k) => {
        if (to[j].noArrow || from[i].noArrow) return null;
        const a = A[i], b = B[j];
        const p = rv(bT(j) - 0.3, 0.9);
        if (p <= 0) return null;
        const f = vertical ? { x: a.x, y: a.y + a.h / 2 + 8 } : { x: a.x + a.w / 2 + 8, y: a.y };
        const t = vertical ? { x: b.x, y: b.y - b.h / 2 - 8 } : { x: b.x - b.w / 2 - 8, y: b.y };
        const cur = { x: f.x + (t.x - f.x) * p, y: f.y + (t.y - f.y) * p };
        return <g key={k} opacity={from[i].dim ? 0.35 : 1}><Arrow from={f} to={cur} width={3} head={10} bend={0} /></g>;
      })}
      {from.map((it, i) => <Cell key={"f" + i} cx={A[i].x} cy={A[i].y} w={A[i].w} h={A[i].h} item={it} p={rv(aT(i))} dimP={it.dim ? rv(aT(i) + 1.6) : 0} vertical={vertical} />)}
      {to.map((it, j) => <Cell key={"t" + j} cx={B[j].x} cy={B[j].y} w={B[j].w} h={B[j].h} item={it} p={rv(bT(j))} dimP={it.dim ? rv(bT(j) + 1.2) : 0} vertical={vertical} />)}
    </g>
  );
}

/* ---------- Ladder ---------- */

export function Ladder({ rows, w, h }: { rows: { label: string; icon?: string }[]; w: number; h: number }) {
  const { rv, dur, vertical } = useScene();
  const n = rows.length;
  const gap = vertical ? 34 : 24;
  const rh = Math.min(vertical ? 84 : 70, (h - gap * (n - 1)) / n);
  const rw = Math.min(vertical ? w : 820, w);
  const x0 = (w - rw) / 2;
  const y0 = (h - (n * rh + (n - 1) * gap)) / 2;
  const at = stepTimes(n, dur, 0.9);
  const hl = rows.reduce((acc, _, i) => (i === 0 ? acc : acc + rv(at(i), 0.9)), 0);
  const fs = vertical ? 28 : 28;
  return (
    <g>
      {rows.map((r, i) => {
        const y = y0 + i * (rh + gap);
        const p = rv(0.3 + i * 0.12);
        return (
          <g key={i} opacity={p} transform={`translate(0 ${(1 - p) * 12})`}>
            <Card x={x0} y={y} w={rw} h={rh} r={16} />
            <Text x={x0 + rh + 8} y={y + rh / 2 + fs * 0.35} size={fs} weight={600}>{r.label}</Text>
            <Text x={x0 + 22} y={y + rh / 2 + fs * 0.35} size={fs} weight={700} color="muted">{i + 1}</Text>
            {i < n - 1 && <SIcon name="arrow-down" x={w / 2 - 10} y={y + rh + (gap - 20) / 2} size={20} color="muted" tint="none" />}
          </g>
        );
      })}
      <g>
        <rect x={x0 - 6} y={y0 + hl * (rh + gap) - 6} width={rw + 12} height={rh + 12} rx={20} style={{ fill: "none", stroke: c.accent }} strokeWidth={4} opacity={rv(at(0))} />
      </g>
    </g>
  );
}

/* ---------- Timeline ---------- */

export function Timeline({ ticks, bars = [], zones = [], w, h }: { ticks: { at: number; label: string; icon?: string }[]; bars?: { from: number; to: number; label: string; tone?: Tone }[]; zones?: { from: number; to: number; label: string }[]; w: number; h: number }) {
  const { rv, dur, vertical } = useScene();
  const m = 50;
  const L = w - 2 * m;
  const axisY = h - (vertical ? 96 : 76);
  const draw = rv(0.3, 1.4);
  const tickAt = stepTimes(ticks.length, dur, 0.9);
  const barH = vertical ? 58 : 54;
  return (
    <g>
      {zones.map((z, i) => (
        <g key={"z" + i} opacity={rv(1.4 + i * 0.4)}>
          <rect x={m + z.from * L} y={axisY - 200} width={(z.to - z.from) * L} height={230} rx={14} style={{ fill: c.sand, stroke: c.sandDeep }} strokeDasharray="6 6" strokeWidth={2} opacity={0.8} />
          <Text x={m + ((z.from + z.to) / 2) * L} y={axisY - 172} size={20} weight={600} color="muted" anchor="middle">{z.label}</Text>
        </g>
      ))}
      <line x1={m} x2={m + L * draw} y1={axisY} y2={axisY} style={{ stroke: c.ink }} strokeWidth={4} strokeLinecap="round" />
      {ticks.map((t, i) => {
        const p = rv(tickAt(i), 0.7);
        const x = m + t.at * L;
        const lab = wrapLabel(t.label, Math.min(190, L / Math.max(2, ticks.length) - 6), vertical ? 20 : 22, 2, 600);
        return (
          <g key={i} opacity={p}>
            <circle cx={x} cy={axisY} r={9} style={{ fill: c.surface, stroke: c.accent }} strokeWidth={4} />
            {lab.lines.map((l, k) => <Text key={k} x={x} y={axisY + 34 + k * lab.size * 1.2} size={lab.size} weight={600} anchor="middle">{l}</Text>)}
            {t.icon && <SIcon name={t.icon} x={x - 26} y={axisY - 84 + (1 - p) * 10} size={52} />}
          </g>
        );
      })}
      {bars.map((b, i) => {
        const y = axisY - (ticks.some((t) => t.icon) ? 100 : 52) - barH - (bars.length - 1 - i) * (barH + 14);
        const p = rv(1.0 + i * 0.9, 1.3);
        const tone = toneMap[b.tone ?? "accent"];
        const bw = (b.to - b.from) * L * p;
        const size = vertical ? 20 : 22;
        const fits = textWidth(b.label, size) + 28 < (b.to - b.from) * L;
        return (
          <g key={i}>
            <rect x={m + b.from * L} y={y} width={bw} height={barH} rx={barH / 2} style={{ fill: c[tone.color] }} />
            {fits && p > 0.7 && <Text x={m + b.from * L + 24} y={y + barH / 2 + size * 0.35} size={size} weight={600} color="surface">{b.label}</Text>}
            {!fits && <Text x={m + b.from * L} y={y - 10} size={size} weight={600} color="ink" opacity={p}>{b.label}</Text>}
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Compare (two columns) ---------- */

export function Compare({ left, right, w, h }: { left: Panel; right: Panel; w: number; h: number }) {
  const { rv, vertical } = useScene();
  const gap = vertical ? 28 : 36;
  const pw = vertical ? w : (w - gap) / 2;
  const ph = vertical ? (h - gap) / 2 : h;
  const panels = [left, right];
  return (
    <g>
      {panels.map((pn, i) => {
        const x = vertical ? 0 : i * (pw + gap), y = vertical ? i * (ph + gap) : 0;
        const p = rv(0.4 + i * 0.5);
        const tone = toneMap[pn.tone ?? (i === 0 ? "clay" : "accent")];
        const isz = Math.min(64, ph * 0.3);
        const ts = vertical ? 32 : 34;
        const ls = vertical ? 26 : 28;
        return (
          <g key={i} opacity={p} transform={`translate(${x} ${y + (1 - p) * 14})`}>
            <Card x={0} y={0} w={pw} h={ph} r={20} />
            <rect x={0} y={0} width={pw} height={8} rx={4} style={{ fill: c[tone.color] }} />
            {pn.icon && <SIcon name={pn.icon} x={24} y={26} size={isz} color={tone.color} tint={tone.tint} />}
            <Text x={pn.icon ? 24 + isz + 16 : 24} y={26 + isz / 2 + ts * 0.35} size={ts} weight={700}>{pn.title}</Text>
            {pn.lines.map((l, k) => {
              const lp = rv(1.4 + i * 1.2 + k * 0.6);
              const lines = wrapLabel(l, pw - 80, ls, 2, 500);
              const yy = 26 + isz + 34 + k * (vertical ? 46 : 56);
              return (
                <g key={k} opacity={lp}>
                  <circle cx={34} cy={yy - 7} r={6} style={{ fill: c[tone.color] }} />
                  {lines.lines.map((t, m) => <Text key={m} x={52} y={yy + m * lines.size * 1.2} size={lines.size} weight={500}>{t}</Text>)}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Bars ---------- */

export function Bars({ bars, line, chips = [], arrow, w, h }: { bars: Bar[]; line?: { value: number; label: string }; chips?: Chip[]; arrow?: boolean; w: number; h: number }) {
  const { rv, vertical } = useScene();
  const n = bars.length;
  const base = h - (vertical ? 96 : 66);
  const maxH = base - (vertical ? 70 : 54);
  const bw = Math.min(vertical ? 170 : 190, (w * 0.8) / (n * 1.5));
  const gap = Math.min(bw * 1.5, (w * 0.8 - n * bw) / Math.max(1, n - 1 || 1));
  const total = n * bw + (n - 1) * gap;
  const x0 = (w - total) / 2;
  const lineY = line ? base - line.value * maxH : 0;
  return (
    <g>
      <line x1={x0 - 30} x2={x0 + total + 30} y1={base} y2={base} style={{ stroke: c.line }} strokeWidth={3} strokeLinecap="round" />
      {bars.map((b, i) => {
        const p = rv(0.5 + i * 0.7, 1.3);
        const x = x0 + i * (bw + gap);
        const tone = toneMap[b.tone ?? "accent"];
        const full = b.value * maxH * p;
        const over = line && b.value > line.value ? (b.value - line.value) * maxH * p : 0;
        const main = full - over;
        const lab = wrapLabel(b.label, bw + gap - 8, vertical ? 22 : 22, 2, 700);
        return (
          <g key={i}>
            <rect x={x} y={base - main} width={bw} height={main} rx={10} style={{ fill: c[tone.color] }} />
            {over > 0 && <rect x={x} y={base - full} width={bw} height={over} rx={10} style={{ fill: c.clayTint, stroke: c.clay }} strokeWidth={2.5} />}
            {b.ghost && <rect x={x} y={base - (b.value + b.ghost) * maxH * p} width={bw} height={b.ghost * maxH * p} rx={10} style={{ fill: "none", stroke: c[tone.color] }} strokeWidth={3} strokeDasharray="8 7" />}
            {b.icon && <g opacity={p}><SIcon name={b.icon} x={x + bw / 2 - 20} y={base - full - 54} size={40} color={tone.color} tint={tone.tint} /></g>}
            {lab.lines.map((l, k) => <Text key={k} x={x + bw / 2} y={base + 30 + k * lab.size * 1.15} size={lab.size} weight={700} anchor="middle">{l}</Text>)}
            {b.note && p > 0.4 && (
              <g opacity={rv(1.2 + i * 0.7)}>
                <Text x={x + bw / 2} y={base - full - (b.icon ? 62 : 14)} size={vertical ? 22 : 22} weight={600} color="muted" anchor="middle">{b.note}</Text>
              </g>
            )}
          </g>
        );
      })}
      {line && (
        <g opacity={rv(1.5)}>
          <line x1={x0 - 30} x2={x0 + total + 30} y1={lineY} y2={lineY} style={{ stroke: c.ink }} strokeWidth={3} strokeDasharray="10 8" />
          {(() => {
            const pw = textWidth(line.label, 18) + 26;
            const left = x0 - 40 - pw / 2;
            const cx = left >= pw / 2 + 8 ? left : Math.min(w - pw / 2 - 8, x0 + total + 40 + pw / 2);
            return <TagPill x={cx} y={lineY - 40} text={line.label} size={18} tone="gold" />;
          })()}
        </g>
      )}
      {arrow && n >= 2 && (() => {
        const p = rv(1.8, 0.9);
        const a = { x: x0 + bw + 10, y: base - maxH * 0.55 }, b = { x: x0 + bw + gap - 10, y: base - maxH * 0.55 };
        return <g opacity={p}><Arrow from={a} to={{ x: a.x + (b.x - a.x) * p, y: a.y }} width={3} head={10} /></g>;
      })()}
      {chips.map((ch, i) => {
        const p = rv(2.2 + i * 0.6);
        const size = 24;
        const cw = textWidth(ch.text, size, 700) + 36 + (ch.icon ? 40 : 0);
        const x = ch.x * w, y = ch.y * h;
        return (
          <g key={i} opacity={p} transform={`translate(0 ${(1 - p) * 10})`}>
            <rect x={x - cw / 2} y={y - 24} width={cw} height={48} rx={24} style={{ fill: c.goldTint, stroke: c.gold }} strokeWidth={2} />
            {ch.icon && <SIcon name={ch.icon} x={x - cw / 2 + 12} y={y - 16} size={32} color="gold" tint="goldTint" />}
            <Text x={x + (ch.icon ? 20 : 0)} y={y + size * 0.35} size={size} weight={700} anchor="middle">{ch.text}</Text>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- Calendar strip ---------- */

export function CalendarStrip({ days = 30, unit, ranges, items, check, w, h }: { days?: number; unit?: string; ranges: { from: number; to: number; label: string }[]; items?: Item[]; check?: boolean; w: number; h: number }) {
  const { rv, dur, vertical } = useScene();
  const cols = days <= 12 ? days : vertical ? 10 : 15;
  const rows = Math.ceil(days / cols);
  const g = 6;
  const cs = Math.min(days <= 12 ? 120 : 62, (w - g * (cols - 1)) / cols);
  const stripH = rows * cs + (rows - 1) * g;
  const stripW = cols * cs + (cols - 1) * g;
  const labelH = 54;
  const hasItems = !!items?.length;
  const topH = stripH + labelH;
  const gapB = hasItems ? 24 : 0;
  const itemsH = hasItems ? h - topH - gapB : 0;
  const yTop = hasItems ? 0 : (h - topH) / 2;
  const x0 = (w - stripW) / 2;
  const hlStart = 1.0;
  return (
    <g>
      <g transform={`translate(0 ${yTop})`}>
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const r = Math.floor(i / cols), ci = i % cols;
          const rg = ranges.find((q) => day >= q.from && day <= q.to);
          const p = rv(0.2 + i * 0.012, 0.6);
          const hp = rg ? rv(hlStart + (day - rg.from) * (days <= 12 ? 0.35 : 0.05), 0.5) : 0;
          return (
            <g key={i} opacity={p}>
              <rect x={x0 + ci * (cs + g)} y={r * (cs + g)} width={cs} height={cs} rx={days <= 12 ? 16 : 10}
                style={{ fill: hp > 0.5 ? c.accent : c.sand, stroke: hp > 0.5 ? c.accent : c.sandDeep }} strokeWidth={2} />
              <Text x={x0 + ci * (cs + g) + cs / 2} y={r * (cs + g) + cs / 2 + (days <= 12 ? 8 : 6)} size={days <= 12 ? 24 : 18} weight={700} color={hp > 0.5 ? "surface" : "muted"} anchor="middle">
                {days <= 12 && unit ? `${unit} ${day}` : day}
              </Text>
            </g>
          );
        })}
        {ranges.map((q, i) => {
          const mid = (q.from - 1 + q.to - 1) / 2;
          const ci = mid % cols;
          const cx = x0 + (days <= 12 || rows === 1 ? ci : cols / 2 - 0.5) * (cs + g) + cs / 2;
          return (
            <g key={i} opacity={rv(hlStart + 0.8 + i * 0.3)}>
              <TagPill x={Math.min(w - 140, Math.max(140, cx))} y={stripH + 12} text={q.label} size={vertical ? 20 : 20} tone="accent" />
            </g>
          );
        })}
      </g>
      {hasItems && (
        <g transform={`translate(0 ${topH + gapB})`}>
          <RowCells items={items!} w={w} h={itemsH} check={check} startAt={2.0} />
        </g>
      )}
    </g>
  );
}

/* ---------- CTA ---------- */

export function CtaCard({ label, url, icon, w, h }: { label: string; url: string; icon: string; w: number; h: number }) {
  const { rv, vertical, sec } = useScene();
  const p = rv(0.3, 0.9);
  const pulse = interpolate(sec, [1.6, 2.1, 2.6], [1, 1.035, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const size = vertical ? 32 : 32;
  const lab = wrapLabel(label, w - 150, size, 2, 700);
  const bw = Math.min(w - 40, Math.max(...lab.lines.map((l) => textWidth(l, lab.size, 700))) + 120);
  const bh = lab.lines.length * lab.size * 1.25 + 40;
  const us = vertical ? 24 : 24;
  const uw = Math.min(w - 20, textWidth(url, us, 600) + 56);
  return (
    <g opacity={p} transform={`translate(0 ${(1 - p) * 14})`}>
      <SIcon name={icon} x={w / 2 - 36} y={h * 0.04} size={72} />
      <g transform={`translate(${w / 2} ${h * 0.5}) scale(${pulse}) translate(${-w / 2} ${-h * 0.5})`}>
        <rect x={(w - bw) / 2} y={h * 0.5 - bh / 2} width={bw} height={bh} rx={bh / 2 > 40 ? 28 : bh / 2} style={{ fill: c.accent }} />
        {lab.lines.map((l, i) => (
          <Text key={i} x={w / 2 - 14} y={h * 0.5 - bh / 2 + 20 + lab.size * 0.95 + i * lab.size * 1.25} size={lab.size} weight={700} color="surface" anchor="middle">{l}</Text>
        ))}
        <SIcon name="arrow-right" x={(w + bw) / 2 - 56} y={h * 0.5 - 14} size={28} color="surface" tint="none" strokeWidth={3} />
      </g>
      <g opacity={rv(0.9)}>
        <rect x={(w - uw) / 2} y={h * 0.5 + bh / 2 + 28} width={uw} height={50} rx={25} style={{ fill: c.sand, stroke: c.sandDeep }} strokeWidth={2} />
        <Text x={w / 2} y={h * 0.5 + bh / 2 + 28 + 33} size={us} weight={600} color="accentDeep" anchor="middle">{url}</Text>
      </g>
    </g>
  );
}
