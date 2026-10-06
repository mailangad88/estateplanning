import { Figure } from "../Figure";
import { Arrow, Card, Doc, Person, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const accounts = [
  { icon: "life-insurance", title: "Life insurance", note: "Pays the person named on the form" },
  { icon: "retirement", title: "Retirement account", note: "401(k) or IRA beneficiary designation" },
  { icon: "bank", title: "POD or TOD account", note: "Payable or transfer on death" },
];

/** Beneficiary designations pass assets directly, whatever the will says. */
export function BeneficiaryBeatsWill({ caption, bare, step }: DiagramProps) {
  return (
    <Figure
      width={960}
      height={600}
      bare={bare}
      caption={caption}
      title="Why a beneficiary form can beat your will"
      desc="Life insurance, retirement accounts and payable-on-death or transfer-on-death accounts usually pass directly to the person named on the account's beneficiary form. They bypass your will, which covers only assets with no named beneficiary. An outdated form, such as one that still names a former spouse, can send money to someone you no longer intend, even if your will says otherwise. Checking each account, naming a backup and updating forms after life events helps avoid surprises."
    >
      <Frame h={600} title="The form on file often wins" sub="These accounts go to the named person, whatever the will says." />
      <S step={step} n={1}>
        <Card x={40} y={120} w={250} h={290} fill="surface" border="line" />
        <Doc x={64} y={142} w={56} h={72} label="WILL" ink="clay" />
        <Text x={64} y={248} size={20} weight={700}>
          Your will
        </Text>
        <Wrap x={64} y={274} w={204} size={15} color="muted" text="Covers assets with no named beneficiary, such as a house in your name alone." lh={20} />
        <Arrow from={{ x: 292, y: 265 }} to={{ x: 354, y: 265 }} color="muted" dashed />
      </S>
      <S step={step} n={2}>
        {accounts.map((a, i) => {
          const y = 120 + i * 100;
          return (
            <g key={a.title}>
              <Card x={360} y={y} w={310} h={90} fill="accentTint" border="accent" />
              <Icon name={a.icon} x={380} y={y + 24} size={42} color="accent" tint="surface" />
              <Text x={436} y={y + 38} size={18} weight={700}>
                {a.title}
              </Text>
              <Wrap x={436} y={y + 62} w={224} size={14} color="muted" text={a.note} lh={17} />
              <Arrow from={{ x: 672, y: y + 45 }} to={{ x: 760, y: 265 }} color="accent" bend={i === 1 ? 0 : i === 0 ? 14 : -14} />
            </g>
          );
        })}
        <Card x={770} y={190} w={150} h={220} fill="surface" border="line" />
        <Person x={845} y={300} size={80} color="accent" />
        <Wrap x={845} y={338} w={130} size={16} weight={700} anchor="middle" text="Person named on the form" lh={20} />
      </S>
      <S step={step} n={3}>
        <Card x={40} y={434} w={880} h={138} fill="sand" border="none" />
        <Text x={64} y={468} size={18} weight={700}>
          Example: an outdated form
        </Text>
        <Doc x={64} y={482} w={42} h={54} ink="clay" />
        <Wrap x={120} y={504} w={190} size={15} text="Old form still names a former spouse" lh={19} />
        <Arrow from={{ x: 318, y: 510 }} to={{ x: 366, y: 510 }} color="clay" />
        <Person x={400} y={540} size={44} color="clay" />
        <Wrap x={438} y={504} w={170} size={15} color="muted" text="The account goes to them, not the people your will names." lh={19} />
        <line x1={640} x2={640} y1={456} y2={550} style={{ stroke: "var(--v-sand-deep, #e3d5bf)" }} strokeWidth={2} />
        <Text x={664} y={468} size={18} weight={700}>
          Keep it current
        </Text>
        <Wrap x={664} y={494} w={236} size={15} text="Check each account. Name a backup. Update after marriage, divorce, births and deaths." lh={20} />
      </S>
    </Figure>
  );
}
