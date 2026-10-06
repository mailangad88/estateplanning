import { Figure } from "../Figure";
import { Arrow, Badge, Card, Pill, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const steps = [
  { icon: "trust", title: "You create the trust", body: "You sign a trust agreement and name your beneficiaries." },
  { icon: "key", title: "You fund it", body: "You retitle your home, accounts and more into the trust's name." },
  { icon: "person", title: "You stay in charge", body: "You are the trustee during life and can change or revoke it." },
  { icon: "hand-heart", title: "If you cannot manage", body: "Your successor trustee steps in to pay bills and manage assets." },
  { icon: "family", title: "At your death", body: "The successor trustee distributes to beneficiaries, outside probate." },
];

const CW = 160;
const cx = (i: number) => 40 + i * (CW + 20);

/** How a revocable living trust moves assets, and what an unfunded asset does. */
export function LivingTrustFlow({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={590}
      bare={bare}
      caption={caption}
      title="How a revocable living trust works"
      desc="You create a revocable living trust, then fund it by retitling assets such as your home and accounts into the trust. During life you act as trustee and can change or revoke it. If you become unable to manage your affairs, a successor trustee you chose steps in. At death the successor trustee distributes the assets to your beneficiaries without probate. Assets left out of the trust, still in your own name, may still need probate."
    >
      <Frame h={590} title="A living trust, from signing to distribution" sub="You stay in control. The plan works only for what the trust owns." />
      {steps.map((s, i) => {
        const x = cx(i);
        return (
          <S key={s.title} step={step} n={i + 1}>
            <Card x={x} y={118} w={CW} h={230} fill={i === 0 ? "accentTint" : "surface"} border={i === 0 ? "accent" : "line"} />
            <Badge x={x + 28} y={148} n={i + 1} r={14} />
            <Icon name={s.icon} x={x + CW - 56} y={130} size={36} color="accent" tint="accentTint" />
            <Wrap x={x + 16} y={198} w={CW - 28} size={17} weight={700} text={s.title} lh={21} />
            <Wrap x={x + 16} y={246} w={CW - 28} size={15} color="muted" text={s.body} lh={19} />
            {i < steps.length - 1 ? <Arrow from={{ x: x + CW + 3, y: 233 }} to={{ x: x + CW + 17, y: 233 }} color="accent" head={6} /> : null}
          </S>
        );
      })}
      <S step={step} n={6}>
        <Card x={40} y={376} w={430} h={190} fill="accentTint" border="accent" />
        <Icon name="trust" x={64} y={396} size={40} color="accent" tint="surface" />
        <Text x={116} y={422} size={19} weight={700}>
          Assets you retitled
        </Text>
        <Wrap x={64} y={462} w={380} size={16} text="Pass through the trust to your beneficiaries, privately, without probate." />
        <Pill x={64} y={512} text="Home" fill="surface" ink="accentDeep" />
        <Pill x={132} y={512} text="Bank account" fill="surface" ink="accentDeep" />
        <Pill x={256} y={512} text="Brokerage" fill="surface" ink="accentDeep" />

        <Card x={490} y={376} w={430} h={190} fill="sand" border="sandDeep" dashed />
        <Icon name="courthouse" x={514} y={396} size={40} color="clay" tint="clayTint" />
        <Text x={566} y={422} size={19} weight={700}>
          Assets left in your own name
        </Text>
        <Wrap x={514} y={462} w={380} size={16} text="Even with a trust, these may still need probate. A will can catch them." />
        <Pill x={514} y={512} text="Forgotten account" fill="surface" ink="muted" />
        <Pill x={672} y={512} text="Vehicle" fill="surface" ink="muted" />
      </S>
    </Figure>
  );
}
