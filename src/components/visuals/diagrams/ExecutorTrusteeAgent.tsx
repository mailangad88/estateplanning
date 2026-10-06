import { Figure } from "../Figure";
import { Card, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { c, type ColorName } from "../tokens";
import { Frame, S, Wrap, wrapCount } from "./shared";
import type { DiagramProps } from "./types";

type Role = {
  icon: string;
  name: string;
  sub: string;
  tone: ColorName;
  tint: ColorName;
  life: number;
  death: number;
  rows: [string, string, string];
};

const roles: Role[] = [
  {
    icon: "gavel",
    name: "Executor",
    sub: "Personal representative",
    tone: "clay",
    tint: "clayTint",
    life: 0,
    death: 1,
    rows: [
      "You, in your will. The court confirms.",
      "After your death, through probate.",
      "Assets in your own name: pays debts, then distributes the rest.",
    ],
  },
  {
    icon: "trust",
    name: "Trustee",
    sub: "Manages a trust",
    tone: "accent",
    tint: "accentTint",
    life: 1,
    death: 1,
    rows: [
      "You, in your trust document.",
      "Often you, during life. A successor steps in at incapacity or death.",
      "Only what has been retitled into the trust, for its beneficiaries.",
    ],
  },
  {
    icon: "power-of-attorney",
    name: "Agent",
    sub: "Power of attorney",
    tone: "sage",
    tint: "sageTint",
    life: 1,
    death: 0,
    rows: [
      "You, in a signed power of attorney.",
      "While you are alive. It ends at your death.",
      "Money, bills and property you name. Medical choices need a healthcare agent.",
    ],
  },
];

const labels = ["Appointed by", "Acts", "Controls"];
const CW = 282;
const cx = (i: number) => 40 + i * (CW + 17);
const TW = CW - 40;

// Row heights are shared across columns so labels line up.
const rowH = [0, 1, 2].map((r) => 24 + Math.max(...roles.map((ro) => wrapCount(ro.rows[r], TW, 15))) * 20 + 16);
const rowY = (r: number) => 262 + rowH.slice(0, r).reduce((a, b) => a + b, 0);
const cardH = 262 - 130 + rowH.reduce((a, b) => a + b, 0) + 6;

/** Who appoints each role, when it acts, and what it controls. */
export function ExecutorTrusteeAgent({ caption, bare, step }: DiagramProps) {
  const H = 130 + cardH + 40;
  return (
    <Figure readable
      width={960}
      height={H}
      bare={bare}
      caption={caption}
      title="Executor, trustee and agent compared"
      desc="An executor is named in your will and acts after your death, settling the assets that go through probate. A trustee is named in your trust and manages the assets inside it, often you during life, with a successor taking over at incapacity or death. A power of attorney agent is named in a signed document and handles money and property only while you are alive; the role ends at death. One person can fill more than one role."
    >
      <Frame h={H} title="Executor, trustee, agent: who does what" sub="Three roles you choose. Each acts at a different time, on different things." />
      {roles.map((r, i) => {
        const x = cx(i);
        return (
          <S key={r.name} step={step} n={i + 1}>
            <Card x={x} y={118} w={CW} h={cardH} fill="surface" border="line" />
            <path d={`M ${x} 192 V 130 Q ${x} 118 ${x + 12} 118 H ${x + CW - 12} Q ${x + CW} 118 ${x + CW} 130 V 192 Z`} style={{ fill: c[r.tint] }} />
            <Icon name={r.icon} x={x + 20} y={133} size={44} color={r.tone} tint="surface" />
            <Text x={x + 78} y={154} size={22} weight={700}>
              {r.name}
            </Text>
            <Text x={x + 78} y={176} size={14} color="muted">
              {r.sub}
            </Text>
            {/* when it acts */}
            <rect x={x + 20} y={210} width={(CW - 44) / 2} height={12} rx={6} style={{ fill: r.life ? c[r.tone] : "var(--v-line, #d9d6cf)" }} opacity={r.life ? 1 : 0.6} />
            <rect x={x + 24 + (CW - 44) / 2} y={210} width={(CW - 44) / 2} height={12} rx={6} style={{ fill: r.death ? c[r.tone] : "var(--v-line, #d9d6cf)" }} opacity={r.death ? 1 : 0.6} />
            <Text x={x + 20} y={242} size={13} color="muted">
              During life
            </Text>
            <Text x={x + CW - 20} y={242} size={13} color="muted" anchor="end">
              After death
            </Text>
            {r.rows.map((t, k) => (
              <g key={k}>
                <line x1={x + 20} x2={x + CW - 20} y1={rowY(k) - 4} y2={rowY(k) - 4} style={{ stroke: "var(--v-line, #d9d6cf)" }} strokeWidth={1.5} />
                <Text x={x + 20} y={rowY(k) + 18} size={13} weight={700} color="muted">
                  {labels[k].toUpperCase()}
                </Text>
                <Wrap x={x + 20} y={rowY(k) + 40} w={TW} size={15} text={t} lh={20} />
              </g>
            ))}
          </S>
        );
      })}
      <S step={step} n={4}>
        <Text x={40} y={H - 16} size={15} color="muted">
          One person can fill more than one role, and each role can have a named backup.
        </Text>
      </S>
    </Figure>
  );
}
