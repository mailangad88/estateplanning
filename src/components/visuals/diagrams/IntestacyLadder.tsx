import { Figure } from "../Figure";
import { Arrow, Card, Person, Pill, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import type { DiagramProps } from "./types";

const rungs = [
  { label: "Spouse and children", note: "First in line in most states", people: 3 },
  { label: "Parents", note: "If no spouse or children", people: 2 },
  { label: "Brothers and sisters", note: "Then their children", people: 2 },
  { label: "More distant relatives", note: "Grandparents, aunts, uncles, cousins", people: 3 },
];

const leftOut = [
  { icon: "partner", label: "Unmarried partner" },
  { icon: "friend", label: "Close friend" },
  { icon: "charity", label: "Charity" },
];

/**
 * Who inherits without a will: the general intestacy order most states
 * follow, plus the people default rules usually leave out.
 */
export function IntestacyLadder({ caption, bare, highlight }: DiagramProps & { highlight?: number }) {
  return (
    <Figure readable
      width={960}
      height={560}
      bare={bare}
      caption={caption}
      title="Who inherits if you die without a will"
      desc="Without a will, state intestacy law decides who inherits, usually in this order: spouse and children first, then parents, then brothers and sisters, then more distant relatives. Unmarried partners, close friends and charities usually receive nothing. The exact order and shares vary by state."
    >
      <Card x={0} y={0} w={960} h={560} fill="paper" border="none" r={0} />
      <Text x={40} y={56} size={28} weight={700}>
        No will? State law picks your heirs.
      </Text>
      <Text x={40} y={86} size={16} color="muted">
        The usual order. Exact shares vary by state.
      </Text>

      {rungs.map((r, i) => {
        const y = 120 + i * 100;
        const on = highlight === undefined || highlight === i;
        return (
          <g key={r.label} opacity={on ? 1 : 0.45}>
            <Card x={40} y={y} w={560} h={80} fill={i === 0 ? "accentTint" : "surface"} border={i === 0 ? "accent" : "line"} />
            <Text x={72} y={y + 50} size={30} weight={700} color="accent">
              {i + 1}
            </Text>
            <Text x={112} y={y + 36} size={20} weight={600}>
              {r.label}
            </Text>
            <Text x={112} y={y + 60} size={15} color="muted">
              {r.note}
            </Text>
            {Array.from({ length: r.people }, (_, k) => (
              <Person key={k} x={470 + k * 38} y={y + 66} size={42} color={k === 0 ? "accent" : k === 1 ? "sage" : "clay"} child={i === 0 && k > 0} />
            ))}
            {i < rungs.length - 1 ? <Arrow from={{ x: 72, y: y + 84 }} to={{ x: 72, y: y + 112 }} color="muted" head={6} /> : null}
          </g>
        );
      })}

      <Card x={640} y={120} w={280} h={380} fill="sand" border="none" />
      <Text x={664} y={160} size={18} weight={700}>
        Usually left out
      </Text>
      {leftOut.map((p, i) => (
        <g key={p.label}>
          <Icon name={p.icon} x={664} y={190 + i * 76} size={40} color="clay" tint="clayTint" />
          <Text x={718} y={216 + i * 76} size={16} weight={600}>
            {p.label}
          </Text>
          <Pill x={718} y={224 + i * 76} text="no claim" fill="surface" ink="muted" size={11} />
        </g>
      ))}
      <Text x={664} y={436} size={15} color="ink" weight={600}>
        A will or trust lets you
      </Text>
      <Text x={664} y={458} size={15} color="ink" weight={600}>
        choose instead.
      </Text>
    </Figure>
  );
}
