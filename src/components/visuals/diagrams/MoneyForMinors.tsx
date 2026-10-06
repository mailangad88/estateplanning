import { Figure } from "../Figure";
import { Card, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import type { ColorName } from "../tokens";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const options: { icon: string; title: string; tone: ColorName; tint: ColorName; facts: [string, string][] }[] = [
  {
    icon: "courthouse",
    title: "Court guardianship of property",
    tone: "clay",
    tint: "clayTint",
    facts: [
      ["Who manages it", "A guardian or conservator of the estate, appointed by a court"],
      ["When the child gets it", "Usually at 18, all at once, with no strings"],
      ["Oversight", "Often a bond, regular accountings and court permission for some spending"],
    ],
  },
  {
    icon: "piggy-bank",
    title: "UTMA custodian",
    tone: "sage",
    tint: "sageTint",
    facts: [
      ["Who manages it", "A custodian you name in your will, on a form or when you open the account"],
      ["When the child gets it", "At an age set by state law, commonly 18 or 21, up to 25 in some states"],
      ["Oversight", "Usually no court. Simple and low cost"],
    ],
  },
  {
    icon: "trust",
    title: "A trust for the children",
    tone: "accent",
    tint: "accentTint",
    facts: [
      ["Who manages it", "A trustee you choose, who follows your written instructions"],
      ["When the child gets it", "At the ages you set, for example in stages at 25, 30 and 35"],
      ["Oversight", "Usually no court. You can set what the money may be used for"],
    ],
  },
];

/** Three ways money can reach a child under 18. */
export function MoneyForMinors({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={640}
      bare={bare}
      caption={caption}
      title="Three ways money can reach a child"
      desc="Children under 18 cannot legally own and manage significant property on their own, so someone has to be put in charge of money left to them. There are three common routes. With a court guardianship of property, a court appoints a guardian or conservator of the estate, which often involves a bond, regular accountings and court permission for some spending, and the child usually receives everything at 18. With a custodian under the Uniform Transfers to Minors Act, you name a custodian who manages the money without court supervision, and the child receives it at an age set by state law, commonly 18 or 21 and up to 25 in some states. With a trust, a trustee you choose follows your instructions, and you set the ages and the rules for how the money is used. Larger amounts, several children or special needs often call for a trust. Rules vary by state."
    >
      <Frame h={640} title="Someone has to manage a child's money" sub="Under 18, a child cannot manage significant property alone. Here are three routes." />
      {options.map((o, i) => {
        const x = 40 + i * 300;
        return (
          <S key={o.title} step={step} n={i + 1}>
            <Card x={x} y={112} w={280} h={394} fill={i === 2 ? "accentTint" : "surface"} border={i === 2 ? "accent" : "line"} />
            <Icon name={o.icon} x={x + 18} y={130} size={44} color={o.tone} tint={o.tint} />
            <Wrap x={x + 76} y={150} w={190} size={18} weight={700} text={o.title} lh={22} />
            {o.facts.map(([label, text], j) => (
              <g key={label}>
                <Text x={x + 20} y={214 + j * 96} size={13} weight={700} color="muted">
                  {label.toUpperCase()}
                </Text>
                <Wrap x={x + 20} y={236 + j * 96} w={242} size={15} text={text} lh={19} />
              </g>
            ))}
          </S>
        );
      })}
      <S step={step} n={4}>
        <Card x={40} y={526} w={880} h={96} fill="sand" border="none" />
        <Icon name="child" x={60} y={548} size={36} color="accent" tint="surface" />
        <Wrap x={112} y={552} w={784} size={15} text="Larger amounts, several children or special needs often call for a trust. Naming a minor directly on life insurance or a retirement account is a common mistake. The custodian age depends on your state, so ask an attorney." lh={20} />
      </S>
    </Figure>
  );
}
