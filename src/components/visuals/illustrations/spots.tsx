import type { ReactNode } from "react";
import { Figure } from "../Figure";
import { Card, Doc, Person, Text } from "../primitives";
import { c, lineProps } from "../tokens";
import { Icon } from "../icons/Icon";
import { Seal, Signature, fillOf } from "./kit";
import { Blob } from "../primitives";

type P = { bare?: boolean; caption?: ReactNode };
const W = 480;
const H = 360;

function Bg({ tint, seed = 1 }: { tint: "accentTint" | "sageTint" | "clayTint" | "goldTint" | "sand"; seed?: number }) {
  return (
    <g>
      <rect width={W} height={H} style={fillOf("paper")} />
      <Blob cx={240} cy={185} r={150} color={tint} seed={seed} />
    </g>
  );
}

export function SpotChecklist({ bare, caption }: P) {
  return (
    <Figure width={W} height={H} bare={bare} caption={caption} title="A checklist with items ticked off" desc="A clipboard with a list of items, most already checked, and a pencil beside it.">
      <Bg tint="accentTint" />
      <rect x={150} y={52} width={190} height={256} rx={18} style={{ fill: c.surface, stroke: c.accent }} strokeWidth={2} />
      <rect x={210} y={40} width={70} height={30} rx={10} style={fillOf("accent")} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={174} y={96 + i * 50} width={28} height={28} rx={8} style={{ fill: i < 3 ? c.accent : c.surface, stroke: c.accent }} strokeWidth={2} />
          {i < 3 ? <path d={`M 181 ${110 + i * 50} l 5 5 l 9 -11`} style={{ fill: "none", stroke: c.surface }} strokeWidth={3} {...lineProps} /> : null}
          <line x1={216} x2={i % 2 ? 292 : 316} y1={110 + i * 50} y2={110 + i * 50} style={{ stroke: c.line }} strokeWidth={4} {...lineProps} />
        </g>
      ))}
      <g transform="rotate(32 380 250)">
        <rect x={370} y={170} width={20} height={130} rx={4} style={fillOf("gold")} />
        <path d="M 370 300 L 380 322 L 390 300 Z" style={fillOf("goldTint")} />
        <rect x={370} y={170} width={20} height={22} rx={4} style={fillOf("clay")} />
      </g>
    </Figure>
  );
}

export function SpotDocumentsSigned({ bare, caption }: P) {
  return (
    <Figure width={W} height={H} bare={bare} caption={caption} title="Signed estate planning documents" desc="A stack of documents with a signature on the top page and a gold seal.">
      <Bg tint="goldTint" seed={2} />
      <g transform="rotate(-8 240 190)"><Doc x={150} y={64} w={170} h={220} /></g>
      <g transform="rotate(5 240 190)"><Doc x={168} y={56} w={170} h={220} tone="surface" /></g>
      <g transform="rotate(5 240 190)">
        <Signature x={198} y={228} w={90} />
        <Seal x={318} y={262} r={28} />
      </g>
      <g transform="rotate(-35 120 280)">
        <rect x={100} y={210} width={16} height={100} rx={5} style={fillOf("accent")} />
        <path d="M 100 310 L 108 332 L 116 310 Z" style={fillOf("accentDeep")} />
      </g>
    </Figure>
  );
}

export function SpotVideoCall({ bare, caption }: P) {
  return (
    <Figure width={W} height={H} bare={bare} caption={caption} title="A video call with your attorney" desc="A laptop showing a video call with two faceless people in tiles, and a small tile of yourself.">
      <Bg tint="sageTint" seed={3} />
      <rect x={96} y={70} width={288} height={186} rx={16} style={{ fill: c.surface, stroke: c.ink }} strokeWidth={2} />
      <rect x={110} y={84} width={260} height={158} rx={8} style={fillOf("accentTint")} />
      <rect x={118} y={92} width={150} height={142} rx={8} style={fillOf("surface")} />
      <Person x={193} y={228} size={118} color="accent" />
      <rect x={276} y={92} width={86} height={66} rx={8} style={fillOf("clayTint")} />
      <Person x={319} y={152} size={62} color="clay" />
      <rect x={276} y={166} width={86} height={68} rx={8} style={fillOf("sageTint")} />
      <Person x={319} y={228} size={62} color="sage" />
      <path d="M 64 256 H 416 L 400 276 Q 396 282 388 282 H 92 Q 84 282 80 276 Z" style={{ fill: c.sandDeep, stroke: c.ink }} strokeWidth={2} {...lineProps} />
      <rect x={210} y={256} width={60} height={8} rx={4} style={fillOf("sand")} />
      <circle cx={420} cy={90} r={22} style={fillOf("accent")} />
      <Icon name="phone" size={26} x={407} y={77} color="surface" tint="none" />
    </Figure>
  );
}

export function SpotSafeStorage({ bare, caption }: P) {
  return (
    <Figure width={W} height={H} bare={bare} caption={caption} title="Keeping documents somewhere safe" desc="A fireproof-style box with a lock, holding folders, with a key beside it.">
      <Bg tint="clayTint" seed={4} />
      <rect x={110} y={90} width={260} height={190} rx={20} style={{ fill: c.accent }} />
      <rect x={128} y={108} width={224} height={154} rx={12} style={{ fill: c.accentDeep }} />
      <rect x={140} y={120} width={200} height={130} rx={8} style={{ fill: c.accent }} />
      <circle cx={240} cy={185} r={36} style={{ fill: c.surface }} />
      <Icon name="lock" size={40} x={220} y={165} color="accentDeep" tint="goldTint" />
      <rect x={140} y={280} width={24} height={12} rx={4} style={fillOf("accentDeep")} />
      <rect x={316} y={280} width={24} height={12} rx={4} style={fillOf("accentDeep")} />
      <g transform="translate(372 258) rotate(-30)">
        <circle cx={0} cy={0} r={16} style={fillOf("gold")} />
        <circle cx={0} cy={0} r={6} style={fillOf("goldTint")} />
        <rect x={12} y={-4} width={56} height={8} rx={4} style={fillOf("gold")} />
        <rect x={50} y={2} width={7} height={16} rx={3} style={fillOf("gold")} />
      </g>
      <Doc x={96} y={236} w={60} h={78} />
    </Figure>
  );
}

export function SpotQuestions({ bare, caption }: P) {
  return (
    <Figure width={W} height={H} bare={bare} caption={caption} title="Having your questions answered" desc="A person with speech bubbles containing question marks, and one bubble with a check mark in reply.">
      <Bg tint="accentTint" seed={5} />
      <Person x={150} y={300} size={190} color="accent" />
      <Card x={190} y={60} w={110} h={84} r={22} fill="surface" border="accent" />
      <Text x={245} y={118} size={50} weight={700} anchor="middle" color="accent">?</Text>
      <path d="M 210 144 L 196 170 L 232 144 Z" style={{ fill: c.surface, stroke: c.accent }} strokeWidth={2} {...lineProps} />
      <Card x={318} y={104} w={110} h={84} r={22} fill="sageTint" border="none" />
      <Icon name="check" size={46} x={350} y={123} color="sage" tint="none" strokeWidth={2.5} />
      <Card x={296} y={218} w={90} h={66} r={18} fill="surface" border="clay" />
      <Text x={341} y={268} size={40} weight={700} anchor="middle" color="clay">?</Text>
    </Figure>
  );
}

export function SpotCalendarReview({ bare, caption }: P) {
  return (
    <Figure width={W} height={H} bare={bare} caption={caption} title="A yearly review on the calendar" desc="A calendar page with one date circled and a circular arrow, showing a plan that is reviewed on a regular schedule.">
      <Bg tint="goldTint" seed={6} />
      <rect x={130} y={60} width={220} height={230} rx={18} style={{ fill: c.surface, stroke: c.accent }} strokeWidth={2} />
      <path d="M 130 106 V 78 Q 130 60 148 60 H 332 Q 350 60 350 78 V 106 Z" style={fillOf("accent")} />
      <rect x={168} y={44} width={10} height={32} rx={5} style={fillOf("accentDeep")} />
      <rect x={302} y={44} width={10} height={32} rx={5} style={fillOf("accentDeep")} />
      {Array.from({ length: 12 }, (_, i) => {
        const x = 160 + (i % 4) * 46;
        const y = 130 + Math.floor(i / 4) * 50;
        return i === 6 ? (
          <g key={i}>
            <circle cx={x + 10} cy={y + 8} r={22} style={fillOf("clay")} />
            <path d={`M ${x + 1} ${y + 8} l 6 6 l 12 -13`} style={{ fill: "none", stroke: c.surface }} strokeWidth={4} {...lineProps} />
          </g>
        ) : (
          <rect key={i} x={x} y={y} width={20} height={16} rx={4} style={fillOf("sand")} />
        );
      })}
      <circle cx={366} cy={252} r={46} style={fillOf("sage")} />
      <Icon name="clock" size={50} x={341} y={227} color="surface" tint="none" strokeWidth={2.2} />
    </Figure>
  );
}
