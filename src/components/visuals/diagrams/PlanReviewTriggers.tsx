import { Figure } from "../Figure";
import { Arrow, Card, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const triggers = [
  { icon: "partner", text: "Marriage or a new partner" },
  { icon: "scale", text: "Divorce or separation" },
  { icon: "child", text: "Birth or adoption" },
  { icon: "heart", text: "A death in the family" },
  { icon: "map-pin", text: "Moving to another state" },
  { icon: "house", text: "Buying property, in or out of state" },
  { icon: "dollar", text: "A big change in wealth" },
  { icon: "briefcase", text: "Starting or selling a business" },
];

const CX = 232;
const CY = 304;
const R = 108;
const pt = (deg: number) => ({ x: CX + R * Math.cos((deg * Math.PI) / 180), y: CY + R * Math.sin((deg * Math.PI) / 180) });

/** The regular review cycle plus the life events that call for an early update. */
export function PlanReviewTriggers({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={620}
      bare={bare}
      caption={caption}
      title="When to review your estate plan"
      desc="An estate plan reflects your life on the day you signed it. Many people review their plan every three to five years on a regular cycle, and also right away after a major life event. Common triggers are marriage or a new partner, divorce or separation, a birth or adoption, a death in the family, moving to another state, buying property in another state, a big change in wealth, and starting or selling a business. A review should cover more than the will or trust: beneficiary designations, transfer-on-death and payable-on-death registrations, powers of attorney and healthcare directives, joint accounts and digital accounts."
    >
      <Frame h={620} title="A plan is a snapshot, so refresh it" sub="Review on a regular cycle, and again when life changes." />
      <S step={step} n={1}>
        <circle cx={CX} cy={CY} r={R} style={{ fill: "var(--v-accent-tint, #dcebf5)", stroke: "none" }} />
        {[-80, 10, 100, 190].map((a) => (
          <Arrow key={a} from={pt(a)} to={pt(a + 70)} color="accent" bend={-22} width={4} head={11} />
        ))}
        <Icon name="calendar" x={CX - 24} y={CY - 62} size={48} color="accent" tint="surface" />
        <Text x={CX} y={CY + 8} size={20} weight={700} anchor="middle">
          Every 3 to 5
        </Text>
        <Text x={CX} y={CY + 32} size={20} weight={700} anchor="middle">
          years
        </Text>
        <Text x={CX} y={CY + 56} size={14} color="muted" anchor="middle">
          regular review
        </Text>
        <Text x={CX} y={CY + R + 52} size={14} color="muted" anchor="middle">
          Many people review on this cycle
        </Text>
      </S>
      <S step={step} n={2}>
        <Text x={490} y={134} size={18} weight={700}>
          Or right away after a life event
        </Text>
        {triggers.map((t, i) => {
          const x = 490 + (i % 2) * 220;
          const y = 152 + Math.floor(i / 2) * 76;
          return (
            <g key={t.text}>
              <Card x={x} y={y} w={208} h={64} fill="surface" border="line" />
              <Icon name={t.icon} x={x + 10} y={y + 15} size={32} color="clay" tint="clayTint" />
              <Wrap x={x + 52} y={y + 26} w={148} size={14} weight={600} text={t.text} lh={17} />
            </g>
          );
        })}
      </S>
      <S step={step} n={3}>
        <Card x={40} y={476} w={880} h={116} fill="sand" border="none" />
        <Text x={64} y={506} size={18} weight={700}>
          Update the whole plan, not only the will
        </Text>
        <Wrap x={64} y={534} w={832} size={15} text="Beneficiary forms on life insurance and retirement accounts, transfer-on-death and payable-on-death registrations, powers of attorney, healthcare directives, joint accounts and digital accounts. Tell your executor and agents where the new documents are." lh={20} />
      </S>
    </Figure>
  );
}
