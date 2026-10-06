import { Figure } from "../Figure";
import { Arrow, Card, Person, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

/** What happens for minor children if both parents die, with and without a named guardian. */
export function GuardianshipDecision({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={600}
      bare={bare}
      caption={caption}
      title="Naming a guardian for minor children"
      desc="If both parents die while their children are minors, someone must be named to raise them. If you name a guardian in your will, courts usually give weight to your choice, though they still review it. If no guardian is named, a court decides based on the children's best interests, often starting with relatives. Raising the children, called guardian of the person, is a separate job from managing any money you leave them, which a custodian or trustee handles and which can be a different person."
    >
      <Frame h={600} title="Who would raise your children?" sub="You can answer this in your will. If you do not, a court will." />
      <S step={step} n={1}>
        <Card x={290} y={112} w={380} h={64} fill="surface" border="line" r={32} />
        <Person x={338} y={160} size={40} color="accent" />
        <Person x={374} y={160} size={40} color="sage" />
        <Person x={408} y={160} size={30} color="clay" child />
        <Wrap x={440} y={138} w={220} size={15} weight={600} text="If both parents die while the children are minors" lh={18} />
      </S>
      <S step={step} n={2}>
        <Arrow from={{ x: 400, y: 180 }} to={{ x: 255, y: 220 }} color="accent" />
        <Card x={40} y={226} w={430} h={150} fill="accentTint" border="accent" />
        <Icon name="will" x={62} y={246} size={40} color="accent" tint="surface" />
        <Wrap x={116} y={264} w={330} size={18} weight={700} text="You name a guardian, and a backup, in your will" lh={22} />
        <Wrap x={62} y={322} w={390} size={15} text="Courts usually give weight to your choice, though they still review it." lh={20} />
      </S>
      <S step={step} n={3}>
        <Arrow from={{ x: 560, y: 180 }} to={{ x: 705, y: 220 }} color="clay" />
        <Card x={490} y={226} w={430} h={150} fill="surface" border="line" />
        <Icon name="gavel" x={512} y={246} size={40} color="clay" tint="clayTint" />
        <Wrap x={566} y={264} w={330} size={18} weight={700} text="No guardian named: a court decides" lh={22} />
        <Wrap x={512} y={322} w={390} size={15} text="Based on the children's best interests, often starting with relatives. Family may not agree." lh={20} />
      </S>
      <S step={step} n={4}>
        <Text x={40} y={420} size={18} weight={700}>
          Two separate jobs, which can go to two different people
        </Text>
        <Card x={40} y={436} w={430} h={136} fill="sand" border="none" />
        <Icon name="family" x={62} y={456} size={40} color="accent" tint="surface" />
        <Text x={116} y={482} size={18} weight={700}>
          Guardian of the person
        </Text>
        <Wrap x={62} y={520} w={390} size={15} text="Raises the children: home, school, health and daily care." lh={20} />
        <Card x={490} y={436} w={430} h={136} fill="sand" border="none" />
        <Icon name="piggy-bank" x={512} y={456} size={40} color="sage" tint="surface" />
        <Text x={566} y={482} size={18} weight={700}>
          Money manager
        </Text>
        <Wrap x={512} y={520} w={390} size={15} text="A custodian or trustee manages what you leave them, and pays for their needs." lh={20} />
      </S>
    </Figure>
  );
}
