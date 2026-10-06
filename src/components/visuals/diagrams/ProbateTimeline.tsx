import { Figure } from "../Figure";
import { Badge, Card, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import type { ColorName } from "../tokens";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const stages = [
  { icon: "document", title: "File the petition" },
  { icon: "gavel", title: "Executor appointed" },
  { icon: "envelope", title: "Notify heirs and creditors" },
  { icon: "calendar", title: "Creditor claim window" },
  { icon: "list", title: "Inventory, pay debts and taxes" },
  { icon: "scale", title: "Final accounting" },
  { icon: "family", title: "Distribute and close" },
];

const phases: { from: number; to: number; label: string; tone: ColorName; tint: ColorName }[] = [
  { from: 0, to: 1, label: "Open the case", tone: "accent", tint: "accentTint" },
  { from: 2, to: 3, label: "Notices and claims", tone: "clay", tint: "clayTint" },
  { from: 4, to: 6, label: "Settle and close", tone: "sage", tint: "sageTint" },
];

const CW = 116;
const GAP = (880 - 7 * CW) / 6;
const cx = (i: number) => 40 + i * (CW + GAP);

/** The usual stages of probate, from filing to closing the estate. */
export function ProbateTimeline({ caption, bare, step }: DiagramProps) {
  return (
    <Figure
      width={960}
      height={524}
      bare={bare}
      caption={caption}
      title="Typical stages of probate"
      desc="Probate usually moves through seven stages: filing a petition with the court, the court appointing an executor, notifying heirs and creditors, a creditor claim window, taking inventory and paying debts and taxes, a final accounting, and distributing what remains before the estate is closed. Probate often takes about 6 to 18 months, but the timing and the steps vary by state and by how complex the estate is."
    >
      <Frame h={524} title="Probate, stage by stage" sub="The usual path. Names, windows and deadlines vary by state." />
      {phases.map((p) => {
        const x = cx(p.from);
        const w = cx(p.to) + CW - x;
        return (
          <S key={p.label} step={step} n={p.from + 1}>
            <Card x={x} y={118} w={w} h={34} fill={p.tint} border="none" r={17} />
            <Text x={x + w / 2} y={141} size={15} weight={600} color="ink" anchor="middle">
              {p.label}
            </Text>
          </S>
        );
      })}
      <S step={step} n={1}>
        <line x1={40} x2={920} y1={206} y2={206} style={{ stroke: "var(--v-line, #d9d6cf)" }} strokeWidth={3} strokeLinecap="round" />
      </S>
      {stages.map((s, i) => {
        const x = cx(i);
        const phase = phases.find((p) => i >= p.from && i <= p.to)!;
        return (
          <S key={s.title} step={step} n={i + 1}>
            <Badge x={x + CW / 2} y={206} n={i + 1} r={18} color={phase.tone} />
            <Card x={x} y={246} w={CW} h={134} fill="surface" border="line" />
            <Icon name={s.icon} x={x + CW / 2 - 18} y={262} size={36} color={phase.tone} tint={phase.tint} />
            <Wrap x={x + CW / 2} y={324} w={CW - 12} size={15} weight={600} anchor="middle" text={s.title} lh={19} />
          </S>
        );
      })}
      <S step={step} n={8}>
        <Card x={40} y={408} w={880} h={92} fill="sand" border="none" />
        <Icon name="clock" x={64} y={436} size={40} color="accent" tint="surface" />
        <Text x={124} y={446} size={20} weight={700}>
          Often 6 to 18 months, varies by state
        </Text>
        <Wrap x={124} y={472} w={770} size={15} color="muted" text="Smaller or simpler estates can move faster. Disputes, out-of-state property or tax filings can add time." />
      </S>
    </Figure>
  );
}
