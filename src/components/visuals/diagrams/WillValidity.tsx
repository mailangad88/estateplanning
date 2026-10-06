import { Figure } from "../Figure";
import { Badge, Card, Doc, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const reqs = [
  { title: "An adult", text: "Most states require you to be at least 18, with a few exceptions." },
  { title: "Sound mind", text: "You understand you are signing a will, roughly what you own, who your close family is and how the will divides things." },
  { title: "Acting freely", text: "The will reflects your own wishes, with no pressure or fraud." },
  { title: "In writing and signed", text: "Signed at the end, with the formalities your state requires." },
  { title: "Witnesses, as your state requires", text: "Usually two adults who watch you sign, ideally people who receive nothing under the will." },
];

/** What generally makes a will valid, plus the optional self-proving affidavit. */
export function WillValidity({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={630}
      bare={bare}
      caption={caption}
      title="What makes a will valid"
      desc="In most states a will is valid when it meets your state's requirements at the moment you sign it. You are an adult, usually at least 18. You have mental capacity, meaning you understand you are signing a will, roughly what you own, who your close family members are and how the will distributes property. You act freely, without undue influence or fraud. The will is in writing and signed with the formalities your state requires, usually in front of two witnesses, who ideally receive nothing under the will. A self-proving affidavit, a sworn statement signed by you and your witnesses in front of a notary, is optional and is accepted in most states. It lets the probate court accept the will without calling the witnesses. Requirements vary by state, and handwritten or electronic wills are accepted in some states but not others."
    >
      <Frame h={630} title="Five things a valid will usually has" sub="Requirements vary by state. These are the common ones." />
      {reqs.map((r, i) => {
        const y = 112 + i * 82;
        return (
          <S key={r.title} step={step} n={i + 1}>
            <Card x={40} y={y} w={590} h={72} fill="surface" border="line" />
            <Badge x={72} y={y + 36} n={i + 1} r={16} />
            <Text x={104} y={y + 28} size={17} weight={700}>
              {r.title}
            </Text>
            <Wrap x={104} y={y + 48} w={510} size={14} color="muted" text={r.text} lh={16} />
          </S>
        );
      })}
      <S step={step} n={6}>
        <Card x={656} y={112} w={264} h={276} fill="accentTint" border="accent" dashed />
        <Text x={676} y={142} size={13} weight={700} color="accentDeep">
          OPTIONAL EXTRA
        </Text>
        <Doc x={676} y={158} w={62} h={80} label="Will" />
        <Icon name="signature" x={750} y={170} size={40} color="accent" tint="surface" />
        <Text x={800} y={196} size={15} weight={700}>
          Notary
        </Text>
        <Text x={676} y={266} size={16} weight={700}>
          Self-proving affidavit
        </Text>
        <Wrap x={676} y={290} w={228} size={14} text="A sworn statement signed by you and your witnesses. Most states accept it, and it can save weeks if a witness has moved." lh={17} />
      </S>
      <S step={step} n={7}>
        <Card x={656} y={404} w={264} h={116} fill="goldTint" border="none" />
        <Icon name="map-pin" x={672} y={418} size={30} color="gold" tint="surface" />
        <Text x={712} y={440} size={16} weight={700}>
          Check your state
        </Text>
        <Wrap x={672} y={468} w={232} size={14} text="Handwritten and electronic wills are accepted in some states, not others." lh={17} />
      </S>
      <S step={step} n={8}>
        <Card x={40} y={546} w={880} h={64} fill="sand" border="none" />
        <Wrap x={64} y={574} w={832} size={15} text="Missing a requirement is a common reason a court refuses a will, and do-it-yourself wills often fail on the signing formalities. An attorney in your state can confirm yours." lh={20} />
      </S>
    </Figure>
  );
}
