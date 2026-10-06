import { Figure } from "../Figure";
import { Card, Pill, Text } from "../primitives";
import { Icon } from "../icons/Icon";
import type { ColorName } from "../tokens";
import { Frame, S, Wrap, pillW } from "./shared";
import type { DiagramProps } from "./types";

type Asset = { icon: string; title: string; how: string; kind: "retitle" | "form"; body: string };

const assets: Asset[] = [
  { icon: "house", title: "Real estate", how: "New deed", kind: "retitle", body: "Usually a new deed, recorded in the county where the property sits." },
  { icon: "bank", title: "Bank accounts", how: "Retitle or POD", kind: "retitle", body: "Many banks retitle the account, or add a payable-on-death name." },
  { icon: "briefcase", title: "Brokerage accounts", how: "Retitle", kind: "retitle", body: "Typically retitled to the trust through your broker." },
  { icon: "retirement", title: "Retirement accounts", how: "Beneficiary form", kind: "form", body: "Usually stay out of the trust. Ask first, because of taxes." },
  { icon: "life-insurance", title: "Life insurance", how: "Beneficiary form", kind: "form", body: "Review who is named, and whether the trust should be." },
  { icon: "key", title: "Personal property", how: "Assignment", kind: "retitle", body: "Furniture, jewelry and keepsakes: a short assignment document can cover them." },
];

const CW = 282;
const pos = (i: number) => ({ x: 40 + (i % 3) * (CW + 17), y: 120 + Math.floor(i / 3) * 196 });
const tone: Record<Asset["kind"], { c: ColorName; tint: ColorName; ink: ColorName }> = {
  retitle: { c: "accent", tint: "accentTint", ink: "accentDeep" },
  form: { c: "sage", tint: "sageTint", ink: "ink" },
};

/** Six asset types to check when funding a trust. */
export function TrustFundingAssets({ caption, bare, step }: DiagramProps) {
  return (
    <Figure
      width={960}
      height={600}
      bare={bare}
      caption={caption}
      title="Funding your trust: six assets to retitle"
      desc="A trust only controls what is in it, so signing is not enough. Six kinds of assets are worth checking. Real estate usually needs a new deed. Bank accounts are often retitled or given a payable-on-death name. Brokerage accounts are typically retitled with your broker. Retirement accounts and life insurance usually stay out of the trust and are handled by naming beneficiaries, so ask before changing them. Personal property can be covered by a short assignment document."
    >
      <Frame h={600} title="Funding your trust: six assets to check" sub="A trust only controls what is in it. Signing is not enough." />
      {assets.map((a, i) => {
        const { x, y } = pos(i);
        const t = tone[a.kind];
        return (
          <S key={a.title} step={step} n={i + 1}>
            <Card x={x} y={y} w={CW} h={180} fill="surface" border="line" />
            <Card x={x + 18} y={y + 16} w={48} h={48} fill={t.tint} border="none" r={24} />
            <Icon name={a.icon} x={x + 28} y={y + 26} size={28} color={t.c} tint="surface" />
            <Text x={x + 18} y={y + 94} size={18} weight={700}>
              {a.title}
            </Text>
            <Pill x={x + CW - 18 - pillW(a.how, 13)} y={y + 26} text={a.how} fill={t.tint} ink={t.ink} size={13} />
            <Wrap x={x + 18} y={y + 120} w={CW - 36} size={15} color="muted" text={a.body} lh={19} />
          </S>
        );
      })}
      <S step={step} n={7}>
        <Card x={40} y={520} w={880} h={56} fill="sand" border="none" />
        <Icon name="hand-heart" x={62} y={532} size={32} color="ink" tint="surface" />
        <Text x={110} y={554} size={15} weight={600}>
          Business interests and vehicles can often be assigned to a trust too. Ask your attorney.
        </Text>
      </S>
    </Figure>
  );
}
