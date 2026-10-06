import { Figure } from "../Figure";
import { Arrow, Card, Person, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import type { ColorName } from "../tokens";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const roles: { icon: string; title: string; sub: string; body: string; tone: ColorName; tint: ColorName }[] = [
  { icon: "power-of-attorney", title: "Financial agent", sub: "Power of attorney", body: "Pays bills, manages accounts and handles property and taxes for you.", tone: "clay", tint: "clayTint" },
  { icon: "heart", title: "Healthcare agent", sub: "Also called a proxy", body: "Makes medical decisions for you when you cannot speak for yourself.", tone: "accent", tint: "accentTint" },
  { icon: "health-directive", title: "Living will", sub: "Advance directive", body: "Puts your own wishes about care, such as life support, in writing.", tone: "accent", tint: "accentTint" },
  { icon: "lock", title: "HIPAA release", sub: "Authorization", body: "Lets the people you name get information from doctors and hospitals.", tone: "accent", tint: "accentTint" },
];

const CW = 208;
const cx = (i: number) => 40 + i * (CW + 16);

/** The documents that decide who speaks for you if you cannot. */
export function PoaHealthcareRoles({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={560}
      bare={bare}
      caption={caption}
      title="Who decides if you cannot"
      desc="If you cannot decide for yourself, four documents name who acts and what they can do. A financial power of attorney names an agent for money, bills and property. A healthcare agent, also called a proxy, makes medical decisions. A living will, or advance directive, records your own wishes about care. A HIPAA authorization lets the people you name receive your medical information. A power of attorney ends at death, when the executor or successor trustee takes over."
    >
      <Frame h={560} title="If you cannot decide, who can?" sub="Four short documents answer it before it matters." />
      <S step={step} n={1}>
        <Text x={cx(0)} y={134} size={14} weight={700} color="clay">
          MONEY
        </Text>
      </S>
      <S step={step} n={2}>
        <Text x={cx(1)} y={134} size={14} weight={700} color="accent">
          HEALTH
        </Text>
      </S>
      {roles.map((r, i) => {
        const x = cx(i);
        return (
          <S key={r.title} step={step} n={i + 1}>
            <Card x={x} y={146} w={CW} h={262} fill="surface" border={i === 0 ? "clay" : "accent"} />
            <Card x={x + 18} y={164} w={52} h={52} fill={r.tint} border="none" r={26} />
            <Icon name={r.icon} x={x + 28} y={174} size={32} color={r.tone} tint="surface" />
            <Text x={x + 18} y={252} size={19} weight={700}>
              {r.title}
            </Text>
            <Text x={x + 18} y={273} size={14} color="muted">
              {r.sub}
            </Text>
            <line x1={x + 18} x2={x + CW - 18} y1={290} y2={290} style={{ stroke: "var(--v-line, #d9d6cf)" }} strokeWidth={2} />
            <Wrap x={x + 18} y={316} w={CW - 36} size={15} text={r.body} lh={20} />
          </S>
        );
      })}
      <S step={step} n={5}>
        <Card x={40} y={432} w={880} h={100} fill="sand" border="none" />
        <Person x={86} y={500} size={50} color="muted" />
        <Text x={134} y={472} size={18} weight={700}>
          A power of attorney ends at death
        </Text>
        <Wrap x={134} y={498} w={470} size={15} color="muted" text="Then the person who settles your affairs takes over." />
        <Arrow from={{ x: 620, y: 482 }} to={{ x: 660, y: 482 }} color="muted" />
        <Card x={672} y={450} w={228} h={30} fill="surface" border="line" r={15} />
        <Text x={786} y={471} size={15} weight={600} anchor="middle">
          Executor (your will)
        </Text>
        <Card x={672} y={488} w={228} h={30} fill="surface" border="line" r={15} />
        <Text x={786} y={509} size={15} weight={600} anchor="middle">
          Successor trustee (trust)
        </Text>
      </S>
    </Figure>
  );
}
