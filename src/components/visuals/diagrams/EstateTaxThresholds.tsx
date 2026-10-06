import { Figure } from "../Figure";
import { Card, Pill, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import { Frame, S, Wrap } from "./shared";
import type { DiagramProps } from "./types";

const notes = [
  { icon: "partner", title: "Married couples", body: "A surviving spouse may use the first spouse's unused exclusion (portability). A return generally must be filed to elect it." },
  { icon: "dollar", title: "Gifts during life", body: "Gifts count against the same exclusion. In 2026, up to $19,000 per person each year does not count." },
  { icon: "map-pin", title: "Some states add more", body: "A few states have an estate or inheritance tax, often with a much lower threshold." },
];

/** The 2026 federal estate tax exclusion in context. */
export function EstateTaxThresholds({ caption, bare, step }: DiagramProps) {
  return (
    <Figure readable
      width={960}
      height={560}
      bare={bare}
      caption={caption}
      title="2026 federal estate tax threshold"
      desc="For 2026 the federal estate tax exclusion is $15,000,000 per person, so most estates owe no federal estate tax. Only the value above the exclusion is taxed, at rates that top out at 40 percent. The bar is illustrative and not to scale: a typical estate falls far below the line. Married couples may be able to use a deceased spouse's unused exclusion by filing a return. Some states have their own estate or inheritance tax with lower thresholds."
    >
      <Frame h={560} title="Most estates owe no federal estate tax" sub="The 2026 federal exclusion is high. Some states set a lower bar." />
      <Pill x={820} y={30} text="2026 figures" fill="accentTint" ink="accentDeep" size={14} />
      <S step={step} n={1}>
        <Text x={40} y={136} size={16} weight={600} color="muted">
          Federal estate tax exclusion, 2026, per person
        </Text>
        <Card x={40} y={150} w={700} h={58} fill="accentTint" border="accent" />
        <Text x={64} y={186} size={22} weight={700} color="accentDeep">
          $15,000,000 excluded
        </Text>
        <Card x={744} y={150} w={176} h={58} fill="clayTint" border="clay" dashed />
        <Text x={832} y={176} size={15} weight={700} anchor="middle">
          Above it: taxed
        </Text>
        <Text x={832} y={196} size={14} anchor="middle" color="muted">
          top rate 40%
        </Text>
      </S>
      <S step={step} n={2}>
        <Text x={40} y={246} size={16} weight={600} color="muted">
          A typical estate (illustrative, not to scale)
        </Text>
        <Card x={40} y={264} w={56} h={30} fill="sageTint" border="sage" />
        <Wrap x={116} y={285} w={780} size={17} weight={600} text="Most estates sit far inside the exclusion, so no federal estate tax is owed." lh={22} />
      </S>
      {notes.map((n, i) => {
        const x = 40 + i * 299;
        return (
          <S key={n.title} step={step} n={3 + i}>
            <Card x={x} y={338} w={282} h={188} fill={i === 2 ? "sand" : "surface"} border={i === 2 ? "none" : "line"} />
            <Icon name={n.icon} x={x + 18} y={356} size={36} color={i === 2 ? "clay" : "accent"} tint={i === 2 ? "clayTint" : "accentTint"} />
            <Text x={x + 66} y={382} size={18} weight={700}>
              {n.title}
            </Text>
            <Wrap x={x + 18} y={424} w={246} size={15} color="ink" text={n.body} lh={20} />
          </S>
        );
      })}
    </Figure>
  );
}
