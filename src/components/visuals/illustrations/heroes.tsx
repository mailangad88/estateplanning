import type { ReactNode } from "react";
import { Figure } from "../Figure";
import { Arrow, Card, Doc, Person, Text } from "../primitives";
import { c, lineProps, stroke } from "../tokens";
import {
  Backdrop,
  Cane,
  Cloud,
  House,
  IconDisc,
  Lines,
  Page,
  Plant,
  Seal,
  Shield,
  Signature,
  Sprout,
  Sun,
  Tree,
  fillOf,
} from "./kit";

type P = { bare?: boolean; caption?: ReactNode };
const W = 1200;
const H = 720;

/** Home page hero: a family in front of a house, with a document and a shield. */
export function HeroFamilyHome({ bare, caption }: P) {
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="A family in front of their home, protected by a plan"
      desc="Two adults and two children, drawn as simple faceless figures, stand in front of a house. A signed will floats on the left and a shield with a check mark on the right, showing a family whose home and wishes are protected by an estate plan."
    >
      <Backdrop tint="accentTint" cx={600} cy={330} r={310} />
      <Sun x={1030} y={140} r={40} />
      <Cloud x={170} y={150} />
      <Cloud x={930} y={250} s={0.7} />
      <Tree x={250} y={610} s={1.1} />
      <Tree x={960} y={610} s={0.95} color="sage" />
      <House x={600} y={600} w={440} />
      <g transform="rotate(-6 170 330)">
        <Doc x={110} y={250} w={120} h={156} label="WILL" />
        <Signature x={134} y={384} w={70} />
      </g>
      <Shield x={1010} y={380} s={74} />
      <Person x={430} y={720} size={240} color="accent" />
      <Person x={545} y={720} size={226} color="clay" />
      <Person x={690} y={720} size={240} color="gold" child />
      <Person x={775} y={720} size={240} color="sage" child />
    </Figure>
  );
}

/** Wills: a signed will with the gifts it directs. */
export function HeroWills({ bare, caption }: P) {
  const gifts = [
    { icon: "house", label: "The home", y: 190, color: "accent" as const },
    { icon: "bank", label: "Savings", y: 340, color: "sage" as const },
    { icon: "heart", label: "Keepsakes", y: 490, color: "clay" as const },
  ];
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="A will that directs who receives what"
      desc="A large signed will with a gold seal sits in the centre. Arrows lead from it to three gifts: the home, savings and keepsakes, each going to a family member. It shows a will putting your wishes in writing."
    >
      <Backdrop tint="goldTint" cx={470} cy={340} r={300} />
      <Page x={290} y={90} w={360} h={470} title="LAST WILL">
        <Lines x={340} y={190} w={260} n={5} gap={26} />
        <Lines x={340} y={340} w={260} n={3} gap={26} short={0.5} />
        <Signature x={345} y={480} w={130} />
        <line x1={345} x2={500} y1={494} y2={494} style={{ stroke: c.line }} strokeWidth={2} />
      </Page>
      <Seal x={590} y={520} r={34} />
      {gifts.map((g) => (
        <g key={g.label}>
          <Arrow from={{ x: 660, y: 330 }} to={{ x: 790, y: g.y + 36 }} color="accent" bend={g.y === 340 ? 0 : g.y < 340 ? -24 : 24} />
          <Card x={800} y={g.y} w={230} h={72} />
          <IconDisc x={840} y={g.y + 36} r={26} name={g.icon} color={g.color} tint={g.color === "accent" ? "accentTint" : g.color === "sage" ? "sageTint" : "clayTint"} />
          <Text x={880} y={g.y + 43} size={20} weight={600}>
            {g.label}
          </Text>
          <Person x={1090} y={g.y + 62} size={64} color={g.color} child={g.y === 340} />
        </g>
      ))}
      <Person x={110} y={720} size={230} color="accent" />
      <Plant x={225} y={690} s={1.4} />
      <Sprout x={1130} y={640} s={1.2} />
    </Figure>
  );
}

/** Trusts: a person places a home into a trust that provides for the family. */
export function HeroTrusts({ bare, caption }: P) {
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="A trust holding assets for the people you love"
      desc="On the left a person hands a house, an account and a document into a shield-shaped trust at the centre. On the right a family receives what the trust provides, over time. It shows how a living trust holds assets and passes them on."
    >
      <Backdrop tint="sageTint" cx={600} cy={340} r={300} />
      <Person x={130} y={720} size={270} color="accent" />
      <Card x={250} y={170} w={110} h={86} />
      <Card x={250} y={290} w={110} h={86} />
      <Card x={250} y={410} w={110} h={86} />
      {["house", "bank", "document"].map((n, i) => (
        <g key={n}>
          <IconDisc x={305} y={213 + i * 120} r={30} name={n} ring={false} />
          <Arrow from={{ x: 366, y: 213 + i * 120 }} to={{ x: 452, y: 330 + (i - 1) * 40 }} bend={(i - 1) * 14} />
        </g>
      ))}
      <Shield x={600} y={330} s={170} fill="accent" check={false} />
      <rect x={510} y={310} width={180} height={140} rx={24} style={fillOf("surface")} />
      <IconDisc x={600} y={360} r={50} name="key" color="gold" tint="goldTint" ring={false} fill="goldTint" />
      <Text x={600} y={440} size={20} weight={700} anchor="middle" color="accentDeep">
        YOUR TRUST
      </Text>
      <Arrow from={{ x: 760, y: 330 }} to={{ x: 860, y: 330 }} color="accent" />
      <Card x={870} y={170} w={250} h={320} r={24} fill="surface" />
      <Person x={940} y={365} size={110} color="clay" />
      <Person x={1000} y={380} size={116} color="gold" />
      <Person x={1062} y={365} size={80} color="sage" child />
      <rect x={900} y={395} width={190} height={14} rx={7} style={fillOf("sageTint")} />
      <IconDisc x={995} y={450} r={32} name="heart" color="clay" tint="clayTint" ring={false} fill="clayTint" />
      <Text x={995} y={225} size={18} weight={600} anchor="middle" color="muted">
        Provided for, on your terms
      </Text>
      <Sprout x={900} y={640} s={1.1} />
    </Figure>
  );
}

/** Probate: a calm path through the paperwork, with a few resting points. */
export function HeroProbate({ bare, caption }: P) {
  const stops = [
    { x: 330, y: 560, icon: "document" },
    { x: 540, y: 440, icon: "folder" },
    { x: 760, y: 340, icon: "check-circle" },
  ];
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="A clear path through probate"
      desc="A gentle winding path leads from a stack of paperwork at the lower left, past a few resting points marked with a document, a folder and a check mark, up to a calm house on the hill. It shows probate as a series of manageable steps with an end in sight."
    >
      <Backdrop tint="sageTint" cx={820} cy={300} r={300} groundY={640} ground="sand" />
      <path d="M 0 560 Q 140 470 330 560" style={{ stroke: "none", fill: "none" }} />
      <path
        d="M 120 690 C 300 650 220 560 400 540 C 600 520 520 420 720 400 C 900 380 880 320 980 300"
        style={{ fill: "none", stroke: c.sandDeep }}
        strokeWidth={64}
        {...lineProps}
      />
      <path
        d="M 120 690 C 300 650 220 560 400 540 C 600 520 520 420 720 400 C 900 380 880 320 980 300"
        style={{ fill: "none", stroke: c.paper }}
        strokeWidth={4}
        strokeDasharray="4 18"
        {...lineProps}
      />
      <Sun x={640} y={120} r={34} />
      <Cloud x={330} y={150} s={0.9} />
      <Cloud x={760} y={210} s={0.6} />
      <House x={1000} y={300} w={230} />
      <Tree x={1110} y={310} s={0.7} />
      <Tree x={880} y={310} s={0.55} color="sage" />
      {stops.map((s, i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y - 70} r={34} style={{ fill: c.surface, stroke: c.accent }} strokeWidth={2} />
          <IconDisc x={s.x} y={s.y - 70} r={30} name={s.icon} ring={false} fill="surface" />
          <path d={`M ${s.x} ${s.y - 36} V ${s.y - 10}`} style={{ stroke: c.accent }} strokeWidth={2} {...lineProps} />
        </g>
      ))}
      <Person x={235} y={655} size={130} color="accent" />
      <g transform="translate(40 560)">
        <Doc x={0} y={0} w={70} h={92} />
        <Doc x={26} y={-14} w={70} h={92} />
        <Doc x={52} y={-28} w={70} h={92} />
      </g>
      <Sprout x={540} y={690} s={1} />
    </Figure>
  );
}

/** Powers of attorney: you choose who handles health and money decisions. */
export function HeroPowersOfAttorney({ bare, caption }: P) {
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="Naming someone you trust to decide for you"
      desc="A person on the left signs a power of attorney document at the centre. From it, two cards lead to two trusted helpers on the right: one handles health care decisions, marked with a heart, and one handles money and bills, marked with a bank. It shows handing off health and financial decisions if you cannot make them yourself."
    >
      <Backdrop tint="accentTint" cx={560} cy={340} r={300} />
      <Person x={170} y={720} size={270} color="accent" />
      <Page x={330} y={110} w={270} h={380} title="POWER OF ATTORNEY">
        <Lines x={368} y={210} w={195} n={4} gap={24} />
        <Signature x={372} y={380} w={110} />
        <line x1={368} x2={510} y1={394} y2={394} style={{ stroke: c.line }} strokeWidth={2} />
      </Page>
      <Seal x={570} y={470} r={30} />
      {[
        { y: 130, icon: "heart", label: "Health care", sub: "Medical decisions", color: "clay" as const, tint: "clayTint" as const },
        { y: 360, icon: "bank", label: "Money and bills", sub: "Finances and property", color: "sage" as const, tint: "sageTint" as const },
      ].map((r, i) => (
        <g key={r.label}>
          <Arrow from={{ x: 610, y: 300 }} to={{ x: 740, y: r.y + 80 }} bend={i === 0 ? -20 : 20} />
          <Card x={750} y={r.y} w={360} h={170} r={22} />
          <IconDisc x={812} y={r.y + 62} r={34} name={r.icon} color={r.color} tint={r.tint} fill={r.tint} ring={false} />
          <Text x={868} y={r.y + 62} size={26} weight={700}>
            {r.label}
          </Text>
          <Text x={868} y={r.y + 92} size={18} color="muted">
            {r.sub}
          </Text>
          <Person x={1072} y={r.y + 158} size={74} color={r.color} />
        </g>
      ))}
      <Sprout x={680} y={640} s={1.2} />
    </Figure>
  );
}

/** Guardianship: parents, children and the person chosen to step in. */
export function HeroGuardianship({ bare, caption }: P) {
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="Parents choosing a guardian for their children"
      desc="Two parents stand on the left and two trusted guardians stand on the right, joined by a soft arch that shelters two children in the middle. A document with a heart between them shows parents naming who would care for their kids."
    >
      <Backdrop tint="clayTint" r={0} />
      <circle cx={600} cy={700} r={300} style={fillOf("clayTint")} />
      <path d="M 260 700 A 340 340 0 0 1 940 700" style={{ fill: "none", stroke: c.clay }} strokeWidth={26} opacity={0.85} {...lineProps} />
      <path d="M 300 700 A 300 300 0 0 1 900 700" style={{ fill: "none", stroke: c.gold }} strokeWidth={26} opacity={0.9} {...lineProps} />
      <path d="M 340 700 A 260 260 0 0 1 860 700" style={{ fill: "none", stroke: c.sage }} strokeWidth={26} opacity={0.9} {...lineProps} />
      <path d="M 0 700 H 1200 V 720 H 0 Z" style={fillOf("sand")} />
      <Person x={125} y={720} size={270} color="accent" />
      <Person x={250} y={720} size={250} color="sage" />
      <Person x={540} y={720} size={190} color="gold" child />
      <Person x={650} y={720} size={170} color="clay" child />
      <Person x={965} y={720} size={270} color="clay" />
      <Person x={1085} y={720} size={250} color="gold" />
      <g transform="translate(600 175)">
        <Doc x={-48} y={-60} w={96} h={124} />
        <path d="M 0 26 c -16 -10 -22 -18 -22 -27 c 0 -9 13 -13 22 -2 c 9 -11 22 -7 22 2 c 0 9 -6 17 -22 27 z" style={fillOf("clay")} />
      </g>
      <Text x={170} y={330} size={22} weight={600} anchor="middle" color="muted">
        Parents
      </Text>
      <Text x={1030} y={330} size={22} weight={600} anchor="middle" color="muted">
        The guardians you choose
      </Text>
      <Text x={600} y={290} size={22} weight={600} anchor="middle" color="muted">
        Cared for, whatever happens
      </Text>
    </Figure>
  );
}

/** Business succession: the keys pass from the founder to the next owner. */
export function HeroBusinessSuccession({ bare, caption }: P) {
  const sx = 430;
  const sw = 340;
  const n = 4;
  const stripe = sw / n;
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="Passing a family business to the next owner"
      desc="A small shop with a striped awning stands in the centre. An older owner on the left passes a key across to a younger successor on the right, with a rising set of bars behind them. It shows a planned handover of a family business."
    >
      <Backdrop tint="goldTint" cx={600} cy={330} r={300} />
      <rect x={sx} y={230} width={sw} height={370} rx={12} style={{ fill: c.surface, stroke: c.line }} strokeWidth={2} />
      <rect x={sx + 28} y={290} width={170} height={150} rx={10} style={fillOf("accentTint")} />
      <rect x={sx + 220} y={290} width={92} height={310} rx={10} style={fillOf("sand")} />
      <circle cx={sx + 238} cy={450} r={7} style={fillOf("gold")} />
      <rect x={sx - 10} y={170} width={sw + 20} height={50} rx={12} style={fillOf("accentDeep")} />
      <Text x={sx + sw / 2} y={203} size={19} weight={700} anchor="middle" color="surface">
        FAMILY BUSINESS
      </Text>
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M ${sx + i * stripe} 220 h ${stripe} a ${stripe / 2} ${stripe / 2} 0 0 1 ${-stripe} 0 z`} style={fillOf(i % 2 === 0 ? "accent" : "accentTint")} />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1000 + i * 52} y={540 - i * 70 - 60} width={38} height={120 + i * 70} rx={10} style={fillOf(i === 2 ? "sage" : "sageTint")} />
      ))}
      <Person x={230} y={720} size={290} color="accent" />
      <Person x={880} y={720} size={270} color="clay" />
      <Arrow from={{ x: 340, y: 560 }} to={{ x: 430, y: 560 }} color="gold" width={3} />
      <Arrow from={{ x: 770, y: 560 }} to={{ x: 810, y: 560 }} color="gold" width={3} />
      <g transform="translate(540 560)">
        <circle cx={0} cy={0} r={22} style={fillOf("gold")} />
        <circle cx={0} cy={0} r={8} style={fillOf("goldTint")} />
        <rect x={18} y={-5} width={74} height={10} rx={5} style={fillOf("gold")} />
        <rect x={66} y={4} width={9} height={20} rx={4} style={fillOf("gold")} />
        <rect x={82} y={4} width={9} height={14} rx={4} style={fillOf("gold")} />
      </g>
    </Figure>
  );
}

/** Aging parents: an adult child and a parent, planning together. */
export function HeroAgingParents({ bare, caption }: P) {
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="An adult child and an aging parent planning together"
      desc="An adult and an older parent with a cane stand close together in front of a home window. A folder of documents with a check mark sits beside them, and a heart floats between them. It shows a family planning ahead together."
    >
      <Backdrop tint="sageTint" cx={560} cy={340} r={300} />
      <rect x={160} y={110} width={380} height={330} rx={24} style={{ fill: c.surface, stroke: c.line }} strokeWidth={2} />
      <rect x={184} y={134} width={332} height={282} rx={14} style={fillOf("accentTint")} />
      <rect x={348} y={134} width={4} height={282} style={fillOf("surface")} />
      <rect x={184} y={272} width={332} height={4} style={fillOf("surface")} />
      <Sun x={260} y={210} r={26} />
      <path d="M 184 416 V 370 Q 260 320 350 372 Q 430 330 516 380 V 416 Z" style={fillOf("sageTint")} />
      <Person x={640} y={720} size={310} color="accent" />
      <Person x={830} y={720} size={270} color="sage" />
      <Cane x={930} y={715} h={130} />
      <g transform="translate(735 300)">
        <path d="M 0 22 c -22 -14 -32 -26 -32 -38 c 0 -12 18 -18 32 -4 c 14 -14 32 -8 32 4 c 0 12 -10 24 -32 38 z" style={fillOf("clay")} />
      </g>
      <g transform="translate(1000 430)">
        <path d="M 0 40 V 10 Q 0 0 10 0 H 56 L 72 18 H 150 Q 160 18 160 28 V 150 Q 160 160 150 160 H 10 Q 0 160 0 150 Z" style={{ fill: c.goldTint, stroke: c.gold }} strokeWidth={2} {...lineProps} />
        <Doc x={22} y={28} w={104} h={120} />
        <circle cx={128} cy={128} r={24} style={fillOf("sage")} />
        <path d="M 117 128 L 125 136 L 140 119" style={{ fill: "none", stroke: c.surface }} strokeWidth={4} {...lineProps} />
      </g>
      <Plant x={500} y={715} s={1.4} />
    </Figure>
  );
}

/** Blended families: two households joined into one, with everyone counted. */
export function HeroBlendedFamily({ bare, caption }: P) {
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="Two households joined as one blended family"
      desc="Two overlapping circles, one blue and one clay, each hold adults and children. In the overlap in the middle, shared children stand together under a small shared house and a heart. It shows a blended family where everyone is considered in the plan."
    >
      <Backdrop tint="paper" ground="sand" r={0} groundY={640} />
      <circle cx={430} cy={340} r={280} style={fillOf("accentTint")} />
      <circle cx={770} cy={340} r={280} style={fillOf("clayTint")} />
      <path d="M 600 117.5 A 280 280 0 0 1 600 562.5 A 280 280 0 0 1 600 117.5 Z" style={fillOf("goldTint")} />
      <path d="M 536 352 L 600 298 L 664 352" style={{ fill: "none", stroke: c.gold }} strokeWidth={8} {...lineProps} />
      <rect x={552} y={346} width={96} height={74} rx={6} style={{ fill: c.surface, stroke: c.gold }} strokeWidth={4} />
      <rect x={588} y={378} width={24} height={42} rx={4} style={fillOf("clay")} />
      <path d="M 600 232 c -26 -17 -38 -30 -38 -44 c 0 -14 22 -22 38 -5 c 16 -17 38 -9 38 5 c 0 14 -12 27 -38 44 z" style={fillOf("clay")} />
      <Person x={290} y={700} size={260} color="accent" />
      <Person x={420} y={700} size={200} color="sage" child />
      <Person x={910} y={700} size={260} color="clay" />
      <Person x={780} y={700} size={200} color="gold" child />
      <Person x={555} y={700} size={190} color="sage" child />
      <Person x={645} y={700} size={190} color="accent" child />
    </Figure>
  );
}

/** Special needs planning: protecting benefits and a lasting circle of support. */
export function HeroSpecialNeeds({ bare, caption }: P) {
  const orbit = [
    { a: -90, icon: "house", color: "accent" as const, tint: "accentTint" as const },
    { a: -18, icon: "heart", color: "clay" as const, tint: "clayTint" as const },
    { a: 54, icon: "key", color: "gold" as const, tint: "goldTint" as const },
    { a: 126, icon: "hand-heart", color: "sage" as const, tint: "sageTint" as const },
    { a: 198, icon: "calendar", color: "accent" as const, tint: "accentTint" as const },
  ];
  const cx = 760;
  const cy = 350;
  const R = 230;
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="A lasting circle of support for a loved one with special needs"
      desc="A figure sits at the centre of a ring of supports: a home, care, security, help and regular reviews, all inside a protective shield. Two parents stand to the left. It shows planning that protects benefits and keeps a loved one supported."
    >
      <Backdrop tint="sageTint" cx={cx} cy={cy} r={310} />
      <circle cx={cx} cy={cy} r={R} style={{ fill: "none", stroke: c.sage }} strokeWidth={2.5} strokeDasharray="3 12" {...lineProps} />
      <circle cx={cx} cy={cy} r={150} style={fillOf("surface")} />
      <Shield x={cx} y={cy - 6} s={116} fill="accentTint" check={false} />
      <Person x={cx} y={cy + 100} size={200} color="sage" />
      {orbit.map((o) => {
        const x = cx + Math.cos((o.a * Math.PI) / 180) * R;
        const y = cy + Math.sin((o.a * Math.PI) / 180) * R;
        return <IconDisc key={o.a} x={x} y={y} r={38} name={o.icon} color={o.color} tint={o.tint} />;
      })}
      <Person x={170} y={720} size={290} color="accent" />
      <Person x={310} y={720} size={270} color="clay" />
      <Arrow from={{ x: 390, y: 520 }} to={{ x: 500, y: 440 }} bend={-30} dashed />
      <Sprout x={60} y={700} s={1} />
    </Figure>
  );
}

/** Estate settlement: quiet and gentle, for families who are grieving. */
export function HeroEstateSettlement({ bare, caption }: P) {
  return (
    <Figure
      width={W}
      height={H}
      bare={bare}
      caption={caption}
      title="A quiet table, a folder and a plant, with help close by"
      desc="Soft morning light fills a window above a quiet table. Two people sit close at the table with a single folder of papers and a small growing plant. It shows steady, unhurried support through settling an estate."
    >
      <Backdrop tint="sageTint" cx={600} cy={300} r={300} ground="none" />
      <rect x={380} y={70} width={440} height={330} rx={26} style={{ fill: c.surface, stroke: c.line }} strokeWidth={2} />
      <rect x={404} y={94} width={392} height={282} rx={14} style={fillOf("goldTint")} />
      <circle cx={600} cy={300} r={60} style={fillOf("gold")} opacity={0.85} />
      <path d="M 404 376 V 320 Q 480 270 570 322 Q 660 270 796 330 V 376 Z" style={fillOf("sageTint")} />
      <rect x={598} y={94} width={4} height={282} style={fillOf("surface")} />
      <rect x={404} y={232} width={392} height={4} style={fillOf("surface")} />
      <path d="M 0 600 H 1200 V 720 H 0 Z" style={fillOf("sand")} />
      <rect x={250} y={520} width={700} height={22} rx={11} style={fillOf("sandDeep")} />
      <rect x={290} y={540} width={14} height={120} rx={6} style={fillOf("sandDeep")} />
      <rect x={896} y={540} width={14} height={120} rx={6} style={fillOf("sandDeep")} />
      <Person x={440} y={520} size={230} color="accent" />
      <Person x={560} y={520} size={216} color="sage" />
      <g transform="translate(660 462)">
        <path d="M 0 58 V 12 Q 0 0 12 0 H 52 L 68 16 H 128 Q 140 16 140 28 V 58 Z" style={{ fill: c.accentDeep }} />
        <rect x={0} y={20} width={140} height={38} rx={8} style={fillOf("accent")} />
        <rect x={18} y={6} width={104} height={20} rx={4} style={fillOf("surface")} />
      </g>
      <Plant x={840} y={520} s={1.2} />
      <Cloud x={190} y={190} s={0.8} />
      <Cloud x={1010} y={150} s={0.9} />
    </Figure>
  );
}

// Keep `stroke` import used for type-narrowing helpers in future edits.
void stroke;
