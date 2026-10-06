import { Figure } from "../Figure";
import { Arrow, Badge, Card, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap, wrapCount } from "./shared";
import type { DiagramProps } from "./types";

const steps = [
  { icon: "list", title: "Take the plan finder", body: "About 2 minutes. A few questions about your family and what you own." },
  { icon: "phone", title: "Talk to our team", body: "A friendly call to answer first questions and set a time." },
  { icon: "chat", title: "Meet your attorney", body: "Talk through your goals, then get a flat-fee quote before you decide." },
  { icon: "pen", title: "Attorney drafts", body: "Your documents are written to fit your family and your state's rules." },
  { icon: "signature", title: "Review and sign", body: "Sign with witnesses or a notary, as your state requires." },
  { icon: "folder", title: "Fund and store", body: "Retitle assets into your trust and keep your documents somewhere safe." },
  { icon: "calendar", title: "Review regularly", body: "Every 3 to 5 years, or after life events such as marriage, a birth or a move." },
];

const CW = 208;
const pos = (i: number) => ({ x: 40 + (i % 4) * (CW + 16), y: 120 + Math.floor(i / 4) * 242 });

/** The seven steps of working with the firm, from plan finder to regular reviews. */
export function PlanningProcess({ caption, bare, step }: DiagramProps) {
  const last = pos(7);
  return (
    <Figure readable
      width={960}
      height={604}
      bare={bare}
      caption={caption}
      title="The planning process, step by step"
      desc="Working with the firm takes seven steps. First you take the plan finder, which takes about two minutes. Second, you talk with the team. Third, you meet your attorney and receive a flat-fee quote. Fourth, the attorney drafts your documents. Fifth, you review and sign, with witnesses or a notary as required. Sixth, you fund your trust and store your documents safely. Seventh, you review your plan every three to five years or after major life events."
    >
      <Frame h={604} title="Your plan in seven steps" sub="Clear steps, a flat-fee quote up front, and no surprises." />
      {steps.map((s, i) => {
        const { x, y } = pos(i);
        const first = i === 0;
        return (
          <S key={s.title} step={step} n={i + 1}>
            <Card x={x} y={y} w={CW} h={226} fill={first ? "accentTint" : "surface"} border={first ? "accent" : "line"} />
            <Badge x={x + 34} y={y + 36} n={i + 1} r={16} />
            <Icon name={s.icon} x={x + CW - 62} y={y + 18} size={40} color="accent" tint={first ? "surface" : "accentTint"} />
            <Wrap x={x + 18} y={y + 92} w={CW - 36} size={18} weight={700} text={s.title} lh={22} />
            <Wrap x={x + 18} y={y + 92 + wrapCount(s.title, CW - 36, 18) * 22 + 6} w={CW - 36} size={15} color="muted" text={s.body} lh={20} />
            {i % 4 !== 3 && i < 6 ? <Arrow from={{ x: x + CW + 2, y: y + 36 }} to={{ x: x + CW + 14, y: y + 36 }} color="accent" head={5} /> : null}
          </S>
        );
      })}
      <S step={step} n={7}>
        <Card x={last.x} y={last.y} w={CW} h={226} fill="sageTint" border="none" />
        <Icon name="check-circle" x={last.x + 18} y={last.y + 24} size={44} color="sage" tint="surface" />
        <Text x={last.x + 18} y={last.y + 110} size={18} weight={700}>
          Plan in place
        </Text>
        <Wrap x={last.x + 18} y={last.y + 136} w={CW - 36} size={15} color="muted" text="Peace of mind that stays current as your life changes." lh={20} />
      </S>
    </Figure>
  );
}
