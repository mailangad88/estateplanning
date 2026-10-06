import { Figure } from "../Figure";
import { Arrow, Card, Person, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import type { ColorName } from "../tokens";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const pieces: { icon: string; title: string; text: string; tone: ColorName; tint: ColorName }[] = [
  { icon: "document", title: "Buy-sell agreement", text: "Who buys a departing owner's share, what triggers it, and how the price is paid.", tone: "accent", tint: "accentTint" },
  { icon: "ladder", title: "Successor and management plan", text: "Who will run it, and who will own it next. These may be different people.", tone: "sage", tint: "sageTint" },
  { icon: "scale", title: "Valuation", text: "A fixed value, a formula or an appraisal. A stale number is a common problem.", tone: "gold", tint: "goldTint" },
  { icon: "trust", title: "Ownership in a trust", text: "Many owners move shares or units into a living trust. Check your operating agreement first.", tone: "clay", tint: "clayTint" },
];

/** What a business owner's succession plan is made of, and what it changes. */
export function BusinessSuccession({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={620}
      bare={bare}
      caption={caption}
      title="Business succession planning"
      desc="A business owner's succession plan answers who will own the business next and who will run it. It usually has four pieces: a buy-sell agreement that sets who buys a departing owner's share, what triggers a sale and how the price is paid; a successor and management plan; a valuation method that is kept up to date; and business ownership held in a trust that fits the rest of the estate plan. With these pieces, the handoff after retirement, disability or death can be smooth, because someone is ready to run the business and the price is already agreed. With no plan, no one is clearly in charge, a handshake understanding can fall apart, and the family may wait years. A buy-sell agreement needs funding, such as life insurance, disability buyout insurance, company savings or an installment note."
    >
      <Frame h={620} title="Who runs it, and who owns it next?" sub="A plan covers retirement, disability, death or a co-owner leaving." />
      <S step={step} n={1}>
        <Person x={104} y={300} size={80} color="accent" />
        <Text x={104} y={328} size={16} weight={700} anchor="middle">
          Business owner
        </Text>
        <Icon name="briefcase" x={80} y={164} size={48} color="accent" tint="accentTint" />
        <Arrow from={{ x: 168, y: 275 }} to={{ x: 214, y: 275 }} color="accent" />
      </S>
      {pieces.map((p, i) => {
        const x = 222 + (i % 2) * 238;
        const y = 118 + Math.floor(i / 2) * 164;
        return (
          <S key={p.title} step={step} n={2 + i}>
            <Card x={x} y={y} w={224} h={150} fill="surface" border="line" />
            <Icon name={p.icon} x={x + 14} y={y + 14} size={32} color={p.tone} tint={p.tint} />
            <Wrap x={x + 56} y={y + 30} w={160} size={16} weight={700} text={p.title} lh={19} />
            <Wrap x={x + 14} y={y + 74} w={198} size={14} color="muted" text={p.text} lh={17} />
          </S>
        );
      })}
      <S step={step} n={6}>
        <Arrow from={{ x: 690, y: 275 }} to={{ x: 718, y: 275 }} color="accent" />
        <Card x={722} y={118} w={198} h={150} fill="sageTint" border="sage" />
        <Icon name="check-circle" x={738} y={132} size={32} color="sage" tint="surface" />
        <Text x={780} y={156} size={17} weight={700}>
          With a plan
        </Text>
        <Wrap x={738} y={196} w={170} size={14} text="Someone is ready to run it, and the price is already agreed." lh={17} />
        <Card x={722} y={282} w={198} h={150} fill="clayTint" border="clay" />
        <Icon name="question-mark" x={738} y={296} size={32} color="clay" tint="surface" />
        <Text x={780} y={320} size={17} weight={700}>
          With no plan
        </Text>
        <Wrap x={738} y={360} w={170} size={14} text="No clear decision-maker, and the family may wait years." lh={17} />
      </S>
      <S step={step} n={7}>
        <Card x={40} y={456} w={880} h={140} fill="sand" border="none" />
        <Icon name="dollar" x={64} y={474} size={36} color="accent" tint="surface" />
        <Text x={112} y={500} size={18} weight={700}>
          A buyout only works if the buyer has the money
        </Text>
        <Wrap x={64} y={534} w={832} size={15} text="Common ways to fund it: life insurance on each owner, disability buyout insurance, company savings set aside over time, or an installment note paid over several years. Tax results differ between buy-sell setups, so owners usually review the choice with a CPA." lh={20} />
      </S>
    </Figure>
  );
}
