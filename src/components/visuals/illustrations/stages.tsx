import type { ReactNode } from "react";
import { Figure } from "../Figure";
import { Doc, Person } from "../primitives";
import { c, lineProps } from "../tokens";
import { Backdrop, Cane, Cloud, House, Plant, Shield, Signature, Sprout, Sun, Tree, fillOf } from "./kit";

type P = { bare?: boolean; caption?: ReactNode };
const W = 1200;
const H = 720;

const heart = (x: number, y: number, s = 1, color: "clay" | "gold" = "clay") => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M 0 22 c -22 -14 -32 -26 -32 -38 c 0 -12 18 -18 32 -4 c 14 -14 32 -8 32 4 c 0 12 -10 24 -32 38 z" style={fillOf(color)} />
  </g>
);

/** Newlyweds: a young couple with two linked rings and a short signed plan. */
export function HeroNewlyweds({ bare, caption }: P) {
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="A young couple starting their first estate plan"
      desc="Two adults, drawn as simple faceless figures, stand side by side under a heart. Two linked rings float above them, and a short signed document and a small apartment building sit beside them. It shows a newly married couple putting a simple plan in place."
    >
      <Backdrop tint="clayTint" cx={600} cy={330} r={300} />
      <Sun x={1020} y={150} r={36} />
      <Cloud x={190} y={140} />
      <Sprout x={300} y={612} s={1.3} />
      <Plant x={940} y={612} s={1.4} />
      <g transform="translate(600 180)">
        <circle cx={-34} cy={0} r={44} style={{ fill: "none", stroke: c.gold }} strokeWidth={12} />
        <circle cx={34} cy={0} r={44} style={{ fill: "none", stroke: c.accent }} strokeWidth={12} />
      </g>
      {heart(600, 300, 1.4)}
      <g transform="rotate(-5 230 360)">
        <Doc x={150} y={270} w={140} h={180} label="OUR PLAN" />
        <Signature x={176} y={426} w={80} />
      </g>
      <g transform="translate(880 300)">
        <rect x={0} y={0} width={190} height={310} rx={10} style={{ fill: c.surface, stroke: c.line }} strokeWidth={3} />
        {[0, 1, 2].map((r) =>
          [0, 1].map((col) => (
            <rect key={`${r}-${col}`} x={26 + col * 80} y={30 + r * 80} width={58} height={50} rx={6} style={fillOf(r === 1 && col === 0 ? "goldTint" : "accentTint")} />
          )),
        )}
        <rect x={76} y={252} width={38} height={58} rx={5} style={fillOf("clay")} />
      </g>
      <Person x={520} y={720} size={270} color="accent" />
      <Person x={680} y={720} size={260} color="clay" />
    </Figure>
  );
}

/** Pre-retirees: a couple with grown children, reviewing a checklist and a nest egg. */
export function HeroPreRetirees({ bare, caption }: P) {
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="A couple nearing retirement reviewing their plan"
      desc="An older couple stands in front of a tall tree, with two grown children beside them. A checklist with ticks and a savings jar sit to one side, and a shield to the other. It shows people getting their plan and accounts in order before retirement."
    >
      <Backdrop tint="sageTint" cx={600} cy={340} r={310} />
      <Sun x={190} y={150} r={40} />
      <Cloud x={980} y={130} s={0.8} />
      <Tree x={600} y={600} s={1.7} color="sage" />
      <g transform="translate(110 280)">
        <rect x={0} y={0} width={170} height={210} rx={14} style={{ fill: c.surface, stroke: c.line }} strokeWidth={3} />
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(24 ${34 + i * 44})`}>
            <rect width={26} height={26} rx={6} style={fillOf(i < 3 ? "sage" : "sageTint")} />
            {i < 3 ? <path d="M 6 13 L 11 18 L 20 8" style={{ fill: "none", stroke: c.surface }} strokeWidth={4} {...lineProps} /> : null}
            <rect x={40} y={8} width={i % 2 ? 70 : 92} height={10} rx={5} style={fillOf("line")} />
          </g>
        ))}
      </g>
      <g transform="translate(980 360)">
        <rect x={-62} y={0} width={124} height={150} rx={30} style={{ fill: c.goldTint, stroke: c.gold }} strokeWidth={4} />
        <rect x={-46} y={-20} width={92} height={26} rx={8} style={fillOf("gold")} />
        <circle cx={0} cy={80} r={30} style={fillOf("gold")} />
        <circle cx={-26} cy={120} r={16} style={fillOf("gold")} />
      </g>
      <Shield x={1030} y={230} s={54} />
      <Person x={430} y={720} size={240} color="accent" />
      <Person x={530} y={720} size={230} color="clay" />
      <Person x={690} y={720} size={235} color="gold" />
      <Person x={790} y={720} size={225} color="sage" />
    </Figure>
  );
}

/** Retirees 65 and over: an older couple at home, a phone, and a folder for the family. */
export function HeroRetirees({ bare, caption }: P) {
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="A retired couple at home with their plan in one folder"
      desc="An older couple, one with a cane, stands in front of their house under a warm sun. A phone with a speech bubble floats on one side and a folder with a check mark sits on the other. It shows a simple plan, started with a phone call, that keeps the family home and wishes in order."
    >
      <Backdrop tint="goldTint" cx={600} cy={330} r={310} />
      <Sun x={600} y={150} r={52} />
      <Cloud x={220} y={170} s={0.9} />
      <Cloud x={980} y={200} s={0.7} />
      <Tree x={170} y={610} s={1.1} />
      <House x={620} y={600} w={400} />
      <g transform="translate(140 270)">
        <rect x={0} y={0} width={110} height={190} rx={22} style={{ fill: c.surface, stroke: c.accent }} strokeWidth={6} />
        <rect x={38} y={16} width={34} height={8} rx={4} style={fillOf("line")} />
        <circle cx={55} cy={160} r={12} style={fillOf("accentTint")} />
        <g transform="translate(70 -70)">
          <rect x={0} y={0} width={150} height={74} rx={20} style={fillOf("accent")} />
          <path d="M 30 70 L 22 100 L 56 72 Z" style={fillOf("accent")} />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={45 + i * 30} cy={37} r={9} style={fillOf("surface")} />
          ))}
        </g>
      </g>
      <g transform="translate(960 400)">
        <path d="M 0 40 V 10 Q 0 0 10 0 H 56 L 72 18 H 150 Q 160 18 160 28 V 150 Q 160 160 150 160 H 10 Q 0 160 0 150 Z" style={{ fill: c.goldTint, stroke: c.gold }} strokeWidth={3} {...lineProps} />
        <Doc x={22} y={28} w={104} h={120} />
        <circle cx={128} cy={128} r={24} style={fillOf("sage")} />
        <path d="M 117 128 L 125 136 L 140 119" style={{ fill: "none", stroke: c.surface }} strokeWidth={4} {...lineProps} />
      </g>
      <Person x={520} y={720} size={270} color="sage" />
      <Person x={700} y={720} size={260} color="clay" />
      <Cane x={790} y={715} h={130} />
    </Figure>
  );
}
