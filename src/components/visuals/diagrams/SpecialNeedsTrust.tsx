import { Figure } from "../Figure";
import { Arrow, Card, Person, Pill, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap, pillW } from "./shared";
import type { DiagramProps } from "./types";

const extras = ["Therapies", "Travel", "A phone", "Activities"];

/** A direct gift versus a third-party supplemental needs trust. */
export function SpecialNeedsTrust({ caption, bare, step }: DiagramProps) {
  let px = 520;
  return (
    <Figure
      width={960}
      height={600}
      bare={bare}
      caption={caption}
      title="Direct gift compared with a special needs trust"
      desc="A gift left directly to a person who receives means-tested benefits such as SSI or Medicaid can count as their own resources and may affect those benefits. A gift left instead to a third-party supplemental needs trust is held by a trustee, who pays for extras such as therapies, travel, a phone or activities, so the benefits can continue. The trust supplements benefits rather than replacing them. Rules differ by program and by who funds the trust, so an attorney should review the details."
    >
      <Frame h={600} title="A gift can help, or can cost a benefit" sub="For someone who relies on SSI, Medicaid or other means-tested benefits." />
      <S step={step} n={1}>
        <Card x={40} y={116} w={400} h={374} fill="surface" border="line" />
        <Text x={64} y={154} size={20} weight={700}>
          Left directly
        </Text>
        <Text x={64} y={178} size={15} color="muted">
          Money goes straight to the person
        </Text>
        <Person x={96} y={290} size={58} color="muted" />
        <Text x={96} y={316} size={14} color="muted" anchor="middle">
          You
        </Text>
        <Arrow from={{ x: 136, y: 262 }} to={{ x: 190, y: 262 }} color="muted" />
        <Icon name="dollar" x={200} y={236} size={52} color="clay" tint="clayTint" />
        <Text x={226} y={316} size={14} color="muted" anchor="middle">
          Gift
        </Text>
        <Arrow from={{ x: 268, y: 262 }} to={{ x: 322, y: 262 }} color="muted" />
        <Person x={364} y={290} size={58} color="sage" />
        <Text x={364} y={316} size={14} color="muted" anchor="middle">
          Beneficiary
        </Text>
        <Card x={64} y={346} w={352} h={120} fill="clayTint" border="none" />
        <Icon name="scale" x={82} y={364} size={32} color="clay" tint="surface" />
        <Wrap x={128} y={380} w={274} size={15} weight={600} text="It can count as the person's own resources." lh={19} />
        <Wrap x={82} y={430} w={318} size={15} color="muted" text="That can affect SSI, Medicaid or other means-tested benefits." lh={19} />
      </S>
      <S step={step} n={2}>
        <Card x={480} y={116} w={440} h={374} fill="accentTint" border="accent" />
        <Text x={504} y={154} size={20} weight={700}>
          Left to a supplemental needs trust
        </Text>
        <Text x={504} y={178} size={15} color="muted">
          A trustee uses it for extras
        </Text>
        <Person x={540} y={290} size={58} color="muted" />
        <Text x={540} y={316} size={14} color="muted" anchor="middle">
          You
        </Text>
        <Arrow from={{ x: 572, y: 262 }} to={{ x: 608, y: 262 }} color="accent" />
        <Icon name="trust" x={614} y={236} size={52} color="accent" tint="surface" />
        <Text x={640} y={316} size={14} color="muted" anchor="middle">
          Trust
        </Text>
        <Arrow from={{ x: 676, y: 262 }} to={{ x: 710, y: 262 }} color="accent" />
        <Person x={744} y={290} size={58} color="accent" />
        <Text x={744} y={316} size={14} color="muted" anchor="middle">
          Trustee
        </Text>
        <Arrow from={{ x: 778, y: 262 }} to={{ x: 814, y: 262 }} color="accent" />
        <Person x={852} y={290} size={58} color="sage" />
        <Text x={852} y={316} size={14} color="muted" anchor="middle">
          Beneficiary
        </Text>
        {extras.map((e) => {
          const x = px - 16;
          px += pillW(e, 13) + 8;
          return <Pill key={e} x={x} y={338} text={e} fill="surface" ink="accentDeep" size={13} />;
        })}
        <Card x={504} y={384} w={392} h={84} fill="sageTint" border="none" />
        <Icon name="check-circle" x={520} y={406} size={32} color="sage" tint="surface" />
        <Wrap x={566} y={420} w={316} size={15} weight={600} text="Benefits can continue. The trust supplements them and does not replace them." lh={19} />
      </S>
      <S step={step} n={3}>
        <Card x={40} y={510} w={880} h={64} fill="sand" border="none" />
        <Wrap x={64} y={538} w={832} size={15} text="This describes a trust funded with someone else's money. Rules differ by program, by state and by whose money funds the trust, so have an attorney review the details." lh={20} />
      </S>
    </Figure>
  );
}
