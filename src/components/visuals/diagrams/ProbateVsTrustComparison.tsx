import { Figure } from "../Figure";
import { Card, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap, wrapCount } from "./shared";
import type { DiagramProps } from "./types";

const rows = [
  { icon: "clock", label: "Time", probate: "Often months to a year or more, depending on the state and the estate.", trust: "Often faster, since no court has to approve each step." },
  { icon: "lock", label: "Privacy", probate: "Court filings are generally public records.", trust: "Administration usually stays private." },
  { icon: "courthouse", label: "Court involvement", probate: "A court supervises and approves key steps.", trust: "Typically none for funded assets, unless a dispute arises." },
  { icon: "dollar", label: "Cost", probate: "Often lower upfront. Court and attorney fees come later and vary by state.", trust: "Typically higher upfront to set up and fund. Often lower to administer." },
  { icon: "map-pin", label: "Property in several states", probate: "Real estate elsewhere can need a second, ancillary probate.", trust: "A funded trust can often avoid ancillary probate." },
];

const COLS = { label: { x: 40, w: 196 }, probate: { x: 248, w: 340 }, trust: { x: 600, w: 320 } };

/** Probate and a living trust compared on time, privacy, court, cost and multi-state property. */
export function ProbateVsTrustComparison({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={630}
      bare={bare}
      caption={caption}
      title="Probate compared with a living trust"
      desc="Probate and a funded revocable living trust differ in five ways. On time, probate often takes months to a year or more while a trust is often faster. On privacy, probate filings are generally public while trust administration usually stays private. On court involvement, probate is court supervised while a funded trust typically needs no court. On cost, probate is often lower upfront with fees later, while a trust is typically higher upfront and often lower to administer. For property in several states, probate can require an ancillary probate in each other state, which a funded trust can often avoid. Details vary by state."
    >
      <Frame h={630} title="Probate or trust: how they compare" sub="General patterns. Details vary by state, and small estates may need neither." />
      <S step={step} n={1}>
        <Card x={COLS.probate.x} y={116} w={COLS.probate.w} h={52} fill="clayTint" border="clay" />
        <Text x={COLS.probate.x + 20} y={149} size={19} weight={700}>
          Probate (will)
        </Text>
        <Card x={COLS.trust.x} y={116} w={COLS.trust.w} h={52} fill="accentTint" border="accent" />
        <Text x={COLS.trust.x + 20} y={149} size={19} weight={700}>
          Living trust
        </Text>
      </S>
      {rows.map((r, i) => {
        const y = 180 + i * 88;
        const mid = (t: string, w: number, size: number) => y + 40 - ((wrapCount(t, w, size) - 1) * 20) / 2 + 5;
        return (
          <S key={r.label} step={step} n={i + 1}>
            <Card x={COLS.label.x} y={y} w={COLS.label.w} h={78} fill="sand" border="none" />
            <Icon name={r.icon} x={COLS.label.x + 14} y={y + 25} size={28} color="ink" tint="surface" />
            <Wrap x={COLS.label.x + 52} y={mid(r.label, COLS.label.w - 62, 16) - 1} w={COLS.label.w - 62} size={16} weight={700} text={r.label} lh={19} />
            <Card x={COLS.probate.x} y={y} w={COLS.probate.w} h={78} fill="surface" border="line" />
            <Wrap x={COLS.probate.x + 20} y={mid(r.probate, COLS.probate.w - 40, 15)} w={COLS.probate.w - 40} size={15} text={r.probate} lh={20} />
            <Card x={COLS.trust.x} y={y} w={COLS.trust.w} h={78} fill="surface" border="accent" />
            <Wrap x={COLS.trust.x + 20} y={mid(r.trust, COLS.trust.w - 40, 15)} w={COLS.trust.w - 40} size={15} text={r.trust} lh={20} />
          </S>
        );
      })}
    </Figure>
  );
}
