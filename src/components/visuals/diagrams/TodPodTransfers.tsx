import { Figure } from "../Figure";
import { Arrow, Card, Person, Pill, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const assets = [
  { icon: "bank", name: "Bank account or CD", tag: "POD" },
  { icon: "folder", name: "Brokerage account", tag: "TOD" },
  { icon: "house", name: "Real estate", tag: "TOD deed, in many states" },
  { icon: "car", name: "Vehicle", tag: "TOD title, in some states" },
];

/** How a POD or TOD designation passes an asset directly at death. */
export function TodPodTransfers({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={596}
      bare={bare}
      caption={caption}
      title="Payable-on-death and transfer-on-death"
      desc="A payable-on-death designation, used mostly for bank accounts, or a transfer-on-death designation, used mostly for brokerage accounts, vehicles and in many states real estate, names who receives the asset when you die. While you are alive you keep full control and can change the beneficiary any time. At death the beneficiary provides a death certificate and ID and completes a claim form, and the asset passes directly to them, usually without court approval, so it skips probate. Naming a backup beneficiary matters, because without one a share may go to another person or into probate. Each account is separate, so check that every form matches your will or trust. These designations do not handle incapacity, and the beneficiary receives the asset outright. Availability for vehicles and real estate varies by state."
    >
      <Frame h={596} title="Name who gets it, skip the court" sub="You stay in control while alive. At death the asset goes straight to the person you named." />
      <S step={step} n={1}>
        {assets.map((a, i) => {
          const y = 116 + i * 78;
          return (
            <g key={a.name}>
              <Card x={40} y={y} w={300} h={66} fill="surface" border="line" />
              <Icon name={a.icon} x={54} y={y + 15} size={36} color="accent" tint="accentTint" />
              <Text x={102} y={y + 28} size={15} weight={700}>
                {a.name}
              </Text>
              <Text x={102} y={y + 50} size={13} color="muted">
                {a.tag}
              </Text>
            </g>
          );
        })}
      </S>
      <S step={step} n={2}>
        {assets.map((a, i) => (
          <Arrow key={a.name} from={{ x: 344, y: 149 + i * 78 }} to={{ x: 384, y: 149 + i * 78 }} color="accent" head={7} />
        ))}
        <Card x={388} y={116} w={252} h={294} fill="accentTint" border="accent" />
        <Icon name="arrow-right" x={408} y={136} size={36} color="accent" tint="surface" />
        <Text x={456} y={162} size={17} weight={700}>
          Passes directly
        </Text>
        <Wrap x={408} y={206} w={216} size={15} text="The beneficiary sends a death certificate and ID and fills out a claim form." lh={19} />
        <Pill x={408} y={300} text="Usually no court approval" fill="surface" ink="accentDeep" size={13} />
        <Pill x={408} y={344} text="Skips probate" fill="sageTint" ink="ink" size={13} />
        <Arrow from={{ x: 644, y: 263 }} to={{ x: 682, y: 263 }} color="accent" head={7} />
      </S>
      <S step={step} n={3}>
        <Card x={686} y={116} w={234} h={142} fill="surface" border="line" />
        <Person x={742} y={218} size={66} color="accent" />
        <Text x={786} y={176} size={16} weight={700}>
          Named
        </Text>
        <Text x={786} y={196} size={16} weight={700}>
          beneficiary
        </Text>
        <Card x={686} y={272} w={234} h={138} fill="sageTint" border="sage" dashed />
        <Person x={742} y={372} size={66} color="sage" />
        <Text x={786} y={328} size={16} weight={700}>
          Backup
        </Text>
        <Text x={786} y={348} size={16} weight={700}>
          beneficiary
        </Text>
      </S>
      <S step={step} n={4}>
        <Card x={40} y={436} w={880} h={136} fill="sand" border="none" />
        <Text x={64} y={468} size={18} weight={700}>
          Keep it lined up with your plan
        </Text>
        {[
          "Name a backup, so a share does not go to another person or into probate by surprise.",
          "Each account is separate. Different names on different accounts can give uneven results.",
          "The beneficiary gets it outright, and it does not cover incapacity. Check every form against your will or trust.",
        ].map((t, i) => (
          <Wrap key={i} x={64 + i * 284} y={500} w={256} size={14} text={t} lh={18} />
        ))}
      </S>
    </Figure>
  );
}
