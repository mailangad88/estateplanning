import { Figure } from "../Figure";
import { Arrow, Card, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { c } from "../tokens";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

/** The Medicaid look-back window and why starting early gives more options. */
export function MedicaidLookback({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={640}
      bare={bare}
      caption={caption}
      title="The Medicaid look-back window"
      desc="When you apply for long-term care Medicaid, the program reviews your past financial records for gifts or transfers made for less than fair value. In most states the look-back window is 60 months before the application, and California uses different rules. A gift made before the window is not part of the review. A gift made inside the window can trigger a penalty period after you apply, during which Medicaid will not pay for care even if you otherwise qualify. The penalty is usually based on the size of the gift and the average cost of care in your state. Planning early, often years before care is needed, gives families more options. Waiting for a crisis leaves fewer, although some options often remain, especially for married couples. Rules vary by state, so an elder law attorney licensed in your state should review the details."
    >
      <Frame h={640} title="Medicaid looks back before it pays" sub="Gifts made in the window before you apply can delay coverage." />
      <S step={step} n={1}>
        <Text x={40} y={150} size={14} weight={600} color="muted">
          Earlier years
        </Text>
        <Text x={338} y={146} size={16} weight={700} color="accentDeep">
          Look-back window
        </Text>
        <Text x={338} y={166} size={15} color="muted">
          60 months in most states, California differs
        </Text>
        <Card x={40} y={186} w={290} h={48} fill="sand" border="none" r={24} />
        <Card x={330} y={186} w={430} h={48} fill="accentTint" border="accent" r={24} />
        <Card x={760} y={186} w={160} h={48} fill="clayTint" border="clay" r={24} />
        <line x1={760} x2={760} y1={136} y2={256} style={{ stroke: c.accent }} strokeWidth={3} strokeLinecap="round" />
        <Text x={770} y={150} size={15} weight={700}>
          You apply
        </Text>
        <Wrap x={774} y={216} w={140} size={14} weight={600} color="clay" text="Penalty period" />
      </S>
      <S step={step} n={2}>
        <Icon name="dollar" x={184} y={194} size={32} color="sage" tint="sageTint" />
        <Wrap x={200} y={274} w={200} size={15} weight={600} anchor="middle" text="A gift made before the window" lh={19} />
        <Icon name="dollar" x={524} y={194} size={32} color="clay" tint="clayTint" />
        <Wrap x={540} y={274} w={210} size={15} weight={600} anchor="middle" text="A gift made inside the window" lh={19} />
        <Arrow from={{ x: 566, y: 212 }} to={{ x: 756, y: 212 }} color="clay" dashed />
        <Wrap x={770} y={258} w={150} size={14} color="muted" text="Medicaid will not pay for care, even if you otherwise qualify" lh={18} />
      </S>
      <S step={step} n={3}>
        <Card x={40} y={340} w={880} h={64} fill="sand" border="none" />
        <Wrap x={64} y={368} w={832} size={15} text="The penalty is usually based on the size of the gift and the average cost of care in your state. Medicaid often asks for years of bank statements, so unexplained withdrawals can cause delays." lh={20} />
      </S>
      <S step={step} n={4}>
        <Card x={40} y={430} w={430} h={150} fill="accentTint" border="accent" />
        <Icon name="calendar" x={60} y={450} size={36} color="accent" tint="surface" />
        <Text x={110} y={476} size={20} weight={700}>
          Planning early
        </Text>
        <Wrap x={64} y={512} w={382} size={15} text="Often years before care is needed. Transfers to a trust can pass the window, and the spouse at home can be protected." lh={20} />
        <Card x={490} y={430} w={430} h={150} fill="surface" border="line" />
        <Icon name="hourglass" x={510} y={450} size={36} color="clay" tint="clayTint" />
        <Text x={560} y={476} size={20} weight={700}>
          Waiting for a crisis
        </Text>
        <Wrap x={514} y={512} w={382} size={15} text="Recent transfers fall inside the window, so fewer options remain, though some usually do, especially for married couples." lh={20} />
      </S>
      <S step={step} n={5}>
        <Text x={40} y={614} size={15} color="muted">
          Window length and penalty rules vary by state. An elder law attorney can check yours.
        </Text>
      </S>
    </Figure>
  );
}
