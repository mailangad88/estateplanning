import { Figure } from "../Figure";
import { Arrow, Badge, Card, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import type { ColorName } from "../tokens";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const steps: { icon: string; title: string; text: string }[] = [
  { icon: "list", title: "List your accounts", text: "Accounts, devices and where files are stored. Keep usernames on the list, not passwords." },
  { icon: "signature", title: "Authorize access in your documents", text: "Ask for express permission in your will, trust and power of attorney." },
  { icon: "person", title: "Name the right person", text: "An executor who is comfortable with technology. Some people name a separate digital executor." },
  { icon: "lock", title: "Store access instructions securely", text: "A password manager, or a written list in a safe. Tell your executor how to reach it." },
];

const cats: { icon: string; title: string; text: string; tone: ColorName; tint: ColorName }[] = [
  { icon: "bank", title: "Financial", text: "Online banking and payment apps. Goal: transfer the value to heirs.", tone: "accent", tint: "accentTint" },
  { icon: "envelope", title: "Email and social", text: "Notify contacts, then close. Profiles can be memorialized or deleted.", tone: "clay", tint: "clayTint" },
  { icon: "folder", title: "Photos and files", text: "Cloud photos, videos and documents. Goal: download and share with family.", tone: "sage", tint: "sageTint" },
  { icon: "key", title: "Crypto", text: "Often held by private keys or seed phrases. If no one can find them, the value is usually lost.", tone: "gold", tint: "goldTint" },
];

/** The steps of digital estate planning and the account types they cover. */
export function DigitalAssets({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={620}
      bare={bare}
      caption={caption}
      title="Planning for your digital assets"
      desc="Digital estate planning has four steps: make an inventory of your accounts, devices and files; authorize access in your will, trust and power of attorney; name a person, sometimes a separate digital executor, who can act; and store access instructions securely, for example in a password manager or a safe. The plan covers several kinds of digital assets: financial accounts such as online banking and payment apps, email and social media, photos and cloud files, and cryptocurrency, which is often controlled by private keys or seed phrases that can be lost for good if no one can find them. In most states a platform's own tool, such as a legacy contact setting, usually controls first, then your estate planning documents, then the platform's terms of service. Details vary by state."
    >
      <Frame h={620} title="Make sure the right person can get in" sub="Four steps, then the kinds of accounts they cover." />
      {steps.map((s, i) => {
        const x = 40 + i * 225;
        return (
          <S key={s.title} step={step} n={i + 1}>
            <Card x={x} y={116} w={205} h={196} fill="surface" border="line" />
            <Badge x={x + 28} y={146} n={i + 1} r={16} />
            <Icon name={s.icon} x={x + 150} y={130} size={38} color="accent" tint="accentTint" />
            <Wrap x={x + 16} y={192} w={176} size={15} weight={700} text={s.title} lh={18} />
            <Wrap x={x + 16} y={234} w={176} size={13} color="muted" text={s.text} lh={16} />
            {i < 3 ? <Arrow from={{ x: x + 207, y: 214 }} to={{ x: x + 221, y: 214 }} color="accent" head={7} /> : null}
          </S>
        );
      })}
      <S step={step} n={5}>
        <Text x={40} y={350} size={18} weight={700}>
          What the plan covers
        </Text>
        {cats.map((k, i) => {
          const x = 40 + i * 225;
          return (
            <g key={k.title}>
              <Card x={x} y={366} w={205} h={140} fill="surface" border="line" />
              <Icon name={k.icon} x={x + 14} y={378} size={30} color={k.tone} tint={k.tint} />
              <Text x={x + 54} y={400} size={16} weight={700}>
                {k.title}
              </Text>
              <Wrap x={x + 14} y={434} w={180} size={13} color="muted" text={k.text} lh={16} />
            </g>
          );
        })}
      </S>
      <S step={step} n={6}>
        <Card x={40} y={526} w={880} h={74} fill="sand" border="none" />
        <Icon name="shield" x={60} y={546} size={34} color="accent" tint="surface" />
        <Wrap x={108} y={550} w={788} size={15} text="In most states a platform's own tool, like a legacy contact setting, usually comes first, then your documents, then the platform's terms. Passwords do not belong in your will. Details vary by state." lh={19} />
      </S>
    </Figure>
  );
}
