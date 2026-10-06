import { Figure } from "../Figure";
import { Card, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap, wrapCount } from "./shared";
import type { DiagramProps } from "./types";

const rows: { icon: string; label: string; a: string; b: string }[] = [
  { icon: "pen", label: "Can you change it?", a: "Yes, any time", b: "Generally no, once signed" },
  { icon: "key", label: "Who controls the assets?", a: "Usually you", b: "A trustee, often not you" },
  { icon: "courthouse", label: "Avoids probate?", a: "Yes, if funded", b: "Yes, if funded" },
  { icon: "scale", label: "Counted in your taxable estate?", a: "Yes", b: "Often no, if set up for that" },
  { icon: "shield", label: "Protected from your creditors?", a: "Generally no", b: "Often yes, depending on state law" },
  { icon: "hourglass", label: "Counted for Medicaid?", a: "Yes", b: "Possibly not, after the look-back period" },
];

const COL = { label: 40, a: 296, b: 612, aw: 300, bw: 308 };

/** Revocable and irrevocable trusts side by side. */
export function RevocableVsIrrevocable({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={640}
      bare={bare}
      caption={caption}
      title="Revocable trust compared with irrevocable trust"
      desc="A revocable trust can be changed any time, is usually controlled by you, avoids probate if it is funded, is counted in your taxable estate, is generally not protected from your creditors and is counted for Medicaid. An irrevocable trust generally cannot be changed once it is signed, is controlled by a trustee who is often not you, also avoids probate if it is funded, is often not counted in your taxable estate if it is set up for that, is often protected from creditors depending on state law, and may not be counted for Medicaid after the look-back period. You give up control and flexibility in exchange for those possible benefits, so an irrevocable trust is a tool for specific goals rather than a general plan. Rules vary by state."
    >
      <Frame h={640} title="Control, or protection" sub="Giving up control is what lets an irrevocable trust do more." />
      <S step={step} n={1}>
        <Card x={COL.a} y={112} w={COL.aw} h={52} fill="accent" border="none" />
        <Text x={COL.a + COL.aw / 2} y={144} size={18} weight={700} color="surface" anchor="middle">
          Revocable trust
        </Text>
        <Card x={COL.b} y={112} w={COL.bw} h={52} fill="clay" border="none" />
        <Text x={COL.b + COL.bw / 2} y={144} size={18} weight={700} color="surface" anchor="middle">
          Irrevocable trust
        </Text>
      </S>
      {rows.map((r, i) => {
        const y = 176 + i * 62;
        return (
          <S key={r.label} step={step} n={2 + Math.floor(i / 2)}>
            <Card x={40} y={y} w={880} h={54} fill={i % 2 ? "paper" : "sand"} border="none" r={10} />
            <Icon name={r.icon} x={52} y={y + 11} size={30} color="accent" tint="surface" />
            <Wrap x={92} y={y + 32 - (wrapCount(r.label, 190, 14) - 1) * 8} w={190} size={14} weight={700} text={r.label} lh={16} />
            <Wrap x={COL.a + 12} y={y + 32 - (wrapCount(r.a, COL.aw - 24, 15) - 1) * 9} w={COL.aw - 24} size={15} text={r.a} lh={18} />
            <Wrap x={COL.b + 12} y={y + 32 - (wrapCount(r.b, COL.bw - 24, 15) - 1) * 9} w={COL.bw - 24} size={15} text={r.b} lh={18} />
          </S>
        );
      })}
      <S step={step} n={5}>
        <Card x={40} y={558} w={880} h={64} fill="goldTint" border="none" />
        <Wrap x={64} y={586} w={832} size={15} text="An irrevocable trust is a tool for specific goals, not a general plan. You give up control and flexibility. Most people's main trust is revocable. Rules vary by state." lh={20} />
      </S>
    </Figure>
  );
}
