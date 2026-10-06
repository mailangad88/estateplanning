import { Figure } from "../Figure";
import { Arrow, Card, Pill, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import type { ColorName } from "../tokens";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

type Row = { icon: string; title: string; body: string; tag?: string };

const will: Row[] = [
  { icon: "will", title: "Your will names who gets what", body: "It takes effect only after you die." },
  { icon: "courthouse", title: "Probate court reviews it", body: "A judge supervises the key steps." },
  { icon: "gavel", title: "Executor distributes assets", body: "Filings are generally public.", tag: "Public" },
];
const trust: Row[] = [
  { icon: "trust", title: "Your trust already holds the assets", body: "You retitled them while you were alive." },
  { icon: "key", title: "Successor trustee steps in", body: "No court needed for funded assets." },
  { icon: "family", title: "Trustee distributes privately", body: "Funded assets skip probate.", tag: "Private" },
];

function Column({ x, tone, tint, title, icon, rows, step, n }: { x: number; tone: ColorName; tint: ColorName; title: string; icon: string; rows: Row[]; step?: number; n: number }) {
  const w = 430;
  return (
    <S step={step} n={n}>
      <Card x={x} y={116} w={w} h={64} fill={tint} border={tone} />
      <Icon name={icon} x={x + 20} y={128} size={40} color={tone} tint="surface" />
      <Text x={x + 76} y={156} size={20} weight={700}>
        {title}
      </Text>
      {rows.map((r, i) => {
        const y = 200 + i * 104;
        return (
          <g key={r.title}>
            <Card x={x} y={y} w={w} h={84} fill="surface" border="line" />
            <Icon name={r.icon} x={x + 20} y={y + 22} size={40} color={tone} tint={tint} />
            <Text x={x + 76} y={y + 33} size={17} weight={600}>
              {r.title}
            </Text>
            <Wrap x={x + 76} y={y + 57} w={w - 96 - (r.tag ? 80 : 0)} text={r.body} size={15} color="muted" />
            {r.tag ? <Pill x={x + w - 82} y={y + 28} text={r.tag} fill={tint} ink={tone === "accent" ? "accentDeep" : "ink"} size={13} /> : null}
            {i < rows.length - 1 ? <Arrow from={{ x: x + 40, y: y + 86 }} to={{ x: x + 40, y: y + 102 }} color="muted" head={5} /> : null}
          </g>
        );
      })}
    </S>
  );
}

/** How a will and a revocable living trust each work after death. */
export function WillVsTrust({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={600}
      bare={bare}
      caption={caption}
      title="A will compared with a revocable living trust"
      desc="A will takes effect after death and usually goes through probate, where a court supervises the executor as assets are distributed, and the filings are generally public. A revocable living trust already holds the assets you retitled into it, so a successor trustee can distribute them privately without probate court. Both can name beneficiaries. A will is where most people name a guardian for minor children, so trust plans usually include a will as well."
    >
      <Frame h={600} title="Will or trust: two paths after death" sub="Both name who inherits. They differ in how assets get there." />
      <Column x={40} tone="clay" tint="clayTint" title="A will" icon="will" rows={will} step={step} n={1} />
      <Column x={490} tone="accent" tint="accentTint" title="A revocable living trust" icon="trust" rows={trust} step={step} n={2} />
      <S step={step} n={3}>
        <Card x={40} y={520} w={880} h={64} fill="sand" border="none" />
        <Icon name="child" x={64} y={534} size={36} color="ink" tint="surface" />
        <Wrap x={116} y={548} w={780} size={15} text="Both can name beneficiaries. A will is where most people name a guardian for minor children, so trust plans usually include one too." weight={600} />
      </S>
    </Figure>
  );
}
