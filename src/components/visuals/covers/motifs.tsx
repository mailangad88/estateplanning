import { c, lineProps } from "../tokens";
import type { ColorName } from "../tokens";
import { Doc, Person } from "../primitives";
import { Plant, Sprout, fillOf } from "../illustrations/kit";

/**
 * Format-specific decoration for the cover's art panel (x 64..536, y 430..711).
 * The centre disc and icon are drawn by ResourceCover; these fill the sides.
 */
export type CoverFormat = "checklist" | "worksheet" | "planner" | "guide" | "template" | "kit" | "workbook" | "email-course" | "default";

type Tones = { main: ColorName; tint: ColorName; deep: ColorName; second: ColorName };

const sk = (k: ColorName) => ({ fill: "none", stroke: c[k] });
const line = { ...lineProps, strokeWidth: 2 };

function CheckCard({ x, y, t }: { x: number; y: number; t: Tones }) {
  return (
    <g transform={`rotate(-6 ${x + 40} ${y + 55})`}>
      <rect x={x} y={y} width={84} height={112} rx={10} style={{ ...fillOf("surface"), stroke: c[t.main] }} strokeWidth={2} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={x + 12} y={y + 18 + i * 30} width={14} height={14} rx={4} style={i < 2 ? fillOf(t.main) : sk("line")} strokeWidth={2} />
          {i < 2 ? <path d={`M${x + 15} ${y + 25 + i * 30} l3 3 5-6`} style={sk("surface")} {...line} /> : null}
          <line x1={x + 34} x2={x + 72} y1={y + 25 + i * 30} y2={y + 25 + i * 30} style={{ stroke: c.line }} {...line} />
        </g>
      ))}
    </g>
  );
}

function FormCard({ x, y, t, dashed }: { x: number; y: number; t: Tones; dashed?: boolean }) {
  return (
    <g transform={`rotate(-5 ${x + 40} ${y + 55})`}>
      <rect x={x} y={y} width={84} height={112} rx={10} style={{ ...fillOf("surface"), stroke: c[t.main] }} strokeWidth={2} />
      <rect x={x + 12} y={y + 12} width={36} height={8} rx={4} style={fillOf(t.main)} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={x + 12} x2={x + 72} y1={y + 42 + i * 18} y2={y + 42 + i * 18} style={{ stroke: c.line }} strokeDasharray={dashed ? "5 5" : undefined} {...line} />
      ))}
      <g transform={`translate(${x + 56} ${y + 70}) rotate(38)`}>
        <rect x={-4} y={-4} width={8} height={46} rx={2} style={fillOf(t.second)} />
        <path d="M-4 42 L0 52 L4 42z" style={fillOf("ink")} />
      </g>
    </g>
  );
}

function Calendar({ x, y, t }: { x: number; y: number; t: Tones }) {
  const hot = new Set([4, 9, 12]);
  return (
    <g transform={`rotate(-4 ${x + 44} ${y + 55})`}>
      <rect x={x} y={y} width={92} height={104} rx={10} style={{ ...fillOf("surface"), stroke: c[t.main] }} strokeWidth={2} />
      <path d={`M${x} ${y + 10} a10 10 0 0 1 10-10 h72 a10 10 0 0 1 10 10 v14 h-92z`} style={fillOf(t.main)} />
      <rect x={x + 22} y={y - 6} width={6} height={14} rx={3} style={fillOf("ink")} />
      <rect x={x + 64} y={y - 6} width={6} height={14} rx={3} style={fillOf("ink")} />
      {Array.from({ length: 15 }, (_, i) => {
        const cx = x + 14 + (i % 5) * 16;
        const cy = y + 40 + Math.floor(i / 5) * 20;
        return hot.has(i) ? <circle key={i} cx={cx} cy={cy} r={7} style={fillOf(t.second)} /> : <circle key={i} cx={cx} cy={cy} r={3.5} style={fillOf("line")} />;
      })}
    </g>
  );
}

function Books({ x, y, t }: { x: number; y: number; t: Tones }) {
  const books: { w: number; h: number; k: ColorName }[] = [
    { w: 22, h: 104, k: t.main },
    { w: 18, h: 90, k: t.second },
    { w: 24, h: 110, k: t.deep === t.main ? "ink" : t.deep },
    { w: 16, h: 84, k: "sand" },
  ];
  let cx = x;
  return (
    <g>
      {books.map((b, i) => {
        const bx = cx;
        cx += b.w + 3;
        return (
          <g key={i}>
            <rect x={bx} y={y + 112 - b.h} width={b.w} height={b.h} rx={4} style={fillOf(b.k)} />
            <line x1={bx + 4} x2={bx + b.w - 4} y1={y + 112 - b.h + 16} y2={y + 112 - b.h + 16} style={{ stroke: c.surface }} {...line} opacity={0.8} />
            <line x1={bx + 4} x2={bx + b.w - 4} y1={y + 112 - 16} y2={y + 112 - 16} style={{ stroke: c.surface }} {...line} opacity={0.8} />
          </g>
        );
      })}
    </g>
  );
}

function Folder({ x, y, t }: { x: number; y: number; t: Tones }) {
  return (
    <g transform={`rotate(-4 ${x + 45} ${y + 50})`}>
      <path d={`M${x} ${y + 14} a8 8 0 0 1 8-8 h26 l8 10 h36 a8 8 0 0 1 8 8 v70 a8 8 0 0 1-8 8 h-70 a8 8 0 0 1-8-8z`} style={fillOf(t.main)} />
      <rect x={x + 10} y={y + 24} width={68} height={50} rx={5} style={fillOf("surface")} transform={`rotate(4 ${x + 44} ${y + 50})`} />
      <rect x={x + 6} y={y + 40} width={82} height={58} rx={8} style={fillOf(t.tint)} stroke={c[t.main]} strokeWidth={2} />
      <line x1={x + 20} x2={x + 74} y1={y + 62} y2={y + 62} style={{ stroke: c.surface }} strokeWidth={3} strokeLinecap="round" />
      <line x1={x + 20} x2={x + 56} y1={y + 76} y2={y + 76} style={{ stroke: c.surface }} strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

function Workbook({ x, y, t }: { x: number; y: number; t: Tones }) {
  return (
    <g transform={`rotate(-5 ${x + 40} ${y + 55})`}>
      <rect x={x + 6} y={y + 6} width={80} height={106} rx={8} style={fillOf(t.main)} opacity={0.35} />
      <rect x={x} y={y} width={80} height={106} rx={8} style={{ ...fillOf("surface"), stroke: c[t.main] }} strokeWidth={2} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={x - 4} y={y + 10 + i * 19} width={14} height={7} rx={3.5} style={fillOf(t.deep)} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={x + 20} x2={x + 68} y1={y + 28 + i * 18} y2={y + 28 + i * 18} style={{ stroke: c.line }} {...line} />
      ))}
    </g>
  );
}

function Envelope({ x, y, t }: { x: number; y: number; t: Tones }) {
  return (
    <g transform={`rotate(-7 ${x + 40} ${y + 28})`}>
      <rect x={x} y={y} width={80} height={56} rx={9} style={{ ...fillOf("surface"), stroke: c[t.main] }} strokeWidth={2} />
      <path d={`M${x + 4} ${y + 8} L${x + 40} ${y + 34} L${x + 76} ${y + 8}`} style={sk(t.main)} {...line} />
    </g>
  );
}

/** Five day dots with a joining line, for email courses. */
function Steps({ cy, t, narrow }: { cy: number; t: Tones; narrow?: boolean }) {
  const xs = narrow ? [196, 248, 300, 352, 404] : [150, 225, 300, 375, 450];
  return (
    <g>
      <line x1={xs[0]} x2={xs[4]} y1={cy} y2={cy} style={{ stroke: c[t.main] }} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      {xs.map((px, i) => (
        <g key={i}>
          <circle cx={px} cy={cy} r={15} style={{ ...fillOf(i === 0 ? t.main : "surface"), stroke: c[t.main] }} strokeWidth={2} />
          <text x={px} y={cy + 5.5} fontSize={15} fontWeight={700} textAnchor="middle" style={{ fill: i === 0 ? c.surface : c[t.deep], fontFamily: "inherit" }}>
            {i + 1}
          </text>
        </g>
      ))}
    </g>
  );
}

export function SideMotifs({ format, t }: { format: CoverFormat; t: Tones }) {
  switch (format) {
    case "checklist":
      return (
        <g>
          <CheckCard x={90} y={484} t={t} />
          <Person x={462} y={711} size={120} color={t.second} />
          <Person x={510} y={711} size={86} color={t.main} child />
        </g>
      );
    case "worksheet":
      return (
        <g>
          <FormCard x={90} y={484} t={t} />
          <Plant x={474} y={711} s={0.9} />
        </g>
      );
    case "template":
      return (
        <g>
          <FormCard x={90} y={484} t={t} dashed />
          <Plant x={474} y={711} s={0.9} />
        </g>
      );
    case "planner":
      return (
        <g>
          <Calendar x={86} y={484} t={t} />
          <Person x={470} y={711} size={110} color={t.second} />
        </g>
      );
    case "guide":
      return (
        <g>
          <Books x={92} y={486} t={t} />
          <Plant x={474} y={711} s={0.9} />
        </g>
      );
    case "kit":
      return (
        <g>
          <Folder x={84} y={490} t={t} />
          <Doc x={448} y={500} w={60} h={80} ink={t.main} />
          <Plant x={474} y={711} s={0.8} />
        </g>
      );
    case "workbook":
      return (
        <g>
          <Workbook x={96} y={488} t={t} />
          <Person x={470} y={711} size={110} color={t.second} />
        </g>
      );
    case "email-course":
      return (
        <g>
          <Envelope x={88} y={484} t={t} />
          <Envelope x={440} y={494} t={{ ...t, main: t.second }} />
          <Steps cy={684} t={t} />
        </g>
      );
    default:
      return (
        <g>
          <g transform="rotate(-9 130 540)">
            <Doc x={92} y={490} w={68} h={90} ink={t.main} />
          </g>
          <Person x={462} y={711} size={120} color={t.second} />
          <Person x={510} y={711} size={86} color={t.main} child />
          <circle cx={112} cy={470} r={8} style={fillOf(t.main)} />
          <circle cx={490} cy={480} r={6} style={fillOf(t.second)} />
          <Plant x={150} y={711} s={0.9} />
        </g>
      );
  }
}

/** Calm covers: sprouts, plus a quiet step row for courses. */
export function CalmMotifs({ format, t }: { format: CoverFormat; t: Tones }) {
  return (
    <g>
      {format === "email-course" ? <Steps cy={684} t={t} narrow /> : null}
      <Sprout x={120} y={706} s={1.1} />
      <Sprout x={486} y={706} s={0.9} />
    </g>
  );
}
