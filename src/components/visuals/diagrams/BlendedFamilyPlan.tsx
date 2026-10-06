import { Figure } from "../Figure";
import { Arrow, Card, Person, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

/** One example structure for a blended family, compared with an all-to-spouse will. */
export function BlendedFamilyPlan({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={590}
      bare={bare}
      caption={caption}
      title="A blended family plan compared with all to spouse"
      desc="In a blended family, a simple will that leaves everything to the surviving spouse hands over full control, so a later new will or new partner could leave children from a first marriage with little or nothing. One example alternative is a trust: it provides for the surviving spouse during life, such as income or use of the home, and then the remainder goes to the children. Details like the trustee and how much the spouse can use are choices to discuss with an attorney."
    >
      <Frame h={590} title="Blended family: spouse and children both" sub="Pat has remarried and has two children from a first marriage." />
      <S step={step} n={1}>
        <Card x={40} y={116} w={430} h={374} fill="surface" border="line" />
        <Text x={64} y={154} size={20} weight={700}>
          Everything to the spouse
        </Text>
        <Text x={64} y={178} size={15} color="muted">
          A simple will
        </Text>
        <Person x={100} y={290} size={58} color="accent" />
        <Text x={100} y={316} size={14} color="muted" anchor="middle">
          Pat
        </Text>
        <Arrow from={{ x: 138, y: 262 }} to={{ x: 200, y: 262 }} color="accent" />
        <Person x={240} y={290} size={58} color="sage" />
        <Text x={240} y={316} size={14} color="muted" anchor="middle">
          Spouse
        </Text>
        <Arrow from={{ x: 280, y: 262 }} to={{ x: 340, y: 262 }} color="muted" dashed />
        <Person x={372} y={290} size={50} color="clay" child />
        <Person x={408} y={290} size={50} color="clay" child />
        <Text x={390} y={316} size={14} color="muted" anchor="middle">
          Children
        </Text>
        <Card x={64} y={346} w={382} h={120} fill="sand" border="none" />
        <Icon name="key" x={82} y={364} size={32} color="clay" tint="surface" />
        <Wrap x={128} y={380} w={300} size={15} weight={600} text="Once it is the spouse's, it is the spouse's choice." lh={19} />
        <Wrap x={82} y={428} w={346} size={15} color="muted" text="A new will or a new partner can leave the children with little or nothing." lh={19} />
      </S>
      <S step={step} n={2}>
        <Card x={490} y={116} w={430} h={374} fill="accentTint" border="accent" />
        <Text x={514} y={154} size={20} weight={700}>
          A trust for both
        </Text>
        <Text x={514} y={178} size={15} color="muted">
          Spouse first, then the children
        </Text>
        <Person x={546} y={290} size={58} color="accent" />
        <Text x={546} y={316} size={14} color="muted" anchor="middle">
          Pat
        </Text>
        <Arrow from={{ x: 584, y: 262 }} to={{ x: 618, y: 262 }} color="accent" />
        <Icon name="trust" x={626} y={236} size={52} color="accent" tint="surface" />
        <Text x={652} y={316} size={14} color="muted" anchor="middle">
          Trust
        </Text>
        <Arrow from={{ x: 688, y: 262 }} to={{ x: 722, y: 262 }} color="accent" />
        <Person x={750} y={290} size={58} color="sage" />
        <Text x={750} y={316} size={14} color="muted" anchor="middle">
          Spouse
        </Text>
        <Arrow from={{ x: 786, y: 262 }} to={{ x: 822, y: 262 }} color="accent" />
        <Person x={850} y={290} size={50} color="clay" child />
        <Person x={884} y={290} size={50} color="clay" child />
        <Text x={868} y={316} size={14} color="muted" anchor="middle">
          Children
        </Text>
        <Card x={514} y={346} w={382} h={120} fill="surface" border="none" />
        <Icon name="house" x={532} y={364} size={32} color="accent" tint="accentTint" />
        <Wrap x={578} y={380} w={300} size={15} weight={600} text="The spouse has income or use of the home for life." lh={19} />
        <Wrap x={532} y={428} w={346} size={15} color="muted" text="After that, what remains goes to the children." lh={19} />
      </S>
      <S step={step} n={3}>
        <Card x={40} y={510} w={880} h={64} fill="sand" border="none" />
        <Wrap x={64} y={536} w={832} size={15} text="One example structure. Who serves as trustee, and how much the spouse can use, are choices to discuss with an attorney." lh={20} />
      </S>
    </Figure>
  );
}
