import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { hex } from "../../../src/components/visuals/tokens";
import { FONT, ease } from "../visual/anim";
import {
  DOMAIN, FINDER_CTA, KICKER, getFaq, getTerm, glossary, iconForCategory, iconForTerm, paletteFor, phrases, shorten, wordCount,
  type Palette,
} from "./data";
import { Backdrop, Footer, Glyph, IconTile, Kicker, OneLine, Paragraph, Pill, Wordmark, card, colorOf, fitParagraph } from "./ui";
import { fitTextOnNLines } from "@remotion/layout-utils";

export const W = 1080, H = 1920, FPS = 30;
const TRANS = 12; // frames of overlap between scenes
const M = 80;
const sec = (s: number) => Math.round(s * FPS);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type Plan = { scenes: number[]; total: number; phrases: string[]; starts: number[]; revealEnd: number };

/** Phrase start times (seconds, local to the scene), spread by word weight at `wps` words per second. */
function timePhrases(ps: string[], wps: number, lead = 0.5) {
  let t = lead;
  const starts = ps.map((p) => { const s = t; t += Math.max(0.9, wordCount(p) / wps); return s; });
  return { starts, end: t };
}
const total = (scenes: number[]) => scenes.reduce((a, b) => a + b, 0) - (scenes.length - 1) * TRANS;

export function glossaryPlan(slug: string): Plan {
  const t = getTerm(slug);
  const ps = phrases(shorten(t.definition, 200), 6);
  const words = wordCount(ps.join(" "));
  const { starts, end } = timePhrases(ps, clamp(words / 5.5, 3.4, 4.6));
  const scenes = [sec(2.2), sec(end + 1.8), sec(3.8)];
  return { scenes, total: total(scenes), phrases: ps, starts, revealEnd: end };
}

export function faqPlan(index: number): Plan {
  const f = getFaq(index);
  const ps = phrases(shorten(f.a, 240), 7);
  const { starts, end } = timePhrases(ps, 2.5);
  const qSec = clamp(wordCount(f.q) / 4 + 1.8, 3.2, 4.6);
  const scenes = [sec(qSec), sec(Math.min(end, 17.5) + 1.2), sec(4)];
  return { scenes, total: total(scenes), phrases: ps, starts, revealEnd: end };
}

const useIn = (at: number, len = 0.7) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [at * FPS, (at + len) * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
};

const Shell: React.FC<{ p: Palette; seed: number; children: React.ReactNode; wordmark?: boolean }> = ({ p, seed, children, wordmark = true }) => (
  <AbsoluteFill style={{ fontFamily: FONT }}>
    <Backdrop w={W} h={H} p={p} seed={seed} />
    {wordmark && <div style={{ position: "absolute", left: M, top: 130 }}><Wordmark size={34} /></div>}
    {children}
  </AbsoluteFill>
);

const phraseFit = (plan: Plan, boxW: number, boxH: number, maxSize: number) => fitParagraph(plan.phrases.join(" "), boxW, boxH, maxSize, 30, 600, 1.38);

/** Phrase-by-phrase caption block. Layout is fixed up front so nothing reflows while words appear. */
const Phrases: React.FC<{ plan: Plan; fit: ReturnType<typeof phraseFit> }> = ({ plan, fit }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const owner: number[] = [];
  plan.phrases.forEach((ph, pi) => ph.split(/\s+/).filter(Boolean).forEach(() => owner.push(pi)));
  const active = plan.starts.reduce((a, s, i) => (t >= s ? i : a), -1);
  const done = t > plan.revealEnd + 0.3;
  return (
    <Paragraph
      fit={fit}
      weight={600}
      wordStyle={(i) => {
        const pi = owner[i] ?? 0;
        const o = interpolate(t, [plan.starts[pi], plan.starts[pi] + 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
        return { opacity: o, color: pi === active && !done ? hex.accent : hex.ink };
      }}
    />
  );
};

const CtaScene: React.FC<{ lead: string; p: Palette; seed: number }> = ({ lead, p, seed }) => {
  const pop = useIn(0.2, 0.8);
  const rest = useIn(0.9, 0.7);
  const frame = useCurrentFrame();
  const pulse = interpolate(frame, [FPS * 1.6, FPS * 2.1, FPS * 2.6], [1, 1.03, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const inner = W - 2 * M;
  const l = fitTextOnNLines({ text: lead, maxLines: 2, maxBoxWidth: inner, fontFamily: "Inter", fontWeight: 700, maxFontSize: 60 });
  const b = fitTextOnNLines({ text: FINDER_CTA, maxLines: 2, maxBoxWidth: 640, fontFamily: "Inter", fontWeight: 700, maxFontSize: 62 });
  return (
    <Shell p={p} seed={seed}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", justifyContent: "center", opacity: pop, translate: `0px ${(1 - pop) * 20}px` }}>
        <IconTile icon="check-circle" size={200} p={{ main: "accent", tint: "accentTint", deep: "accentDeep" }} radius={56} />
      </div>
      <div style={{ position: "absolute", left: M, right: M, top: 620, textAlign: "center", color: hex.ink, fontWeight: 700, fontSize: l.fontSize, lineHeight: 1.2, opacity: pop }}>
        {l.lines.map((x, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{x}</div>)}
      </div>
      <div style={{ position: "absolute", left: M, right: M, top: 820, display: "flex", flexDirection: "column", alignItems: "center", gap: 36, opacity: rest, translate: `0px ${(1 - rest) * 16}px` }}>
        <div style={{ scale: String(pulse), display: "flex", alignItems: "center", gap: 28, background: hex.accent, color: hex.surface, borderRadius: 60, padding: "40px 56px", fontWeight: 700, fontSize: b.fontSize, lineHeight: 1.15, boxShadow: "0 18px 40px rgba(31,95,139,0.28)" }}>
          <div>{b.lines.map((x, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{x}</div>)}</div>
          <Glyph name="arrow-right" size={b.fontSize * 0.9} color="surface" tint="none" strokeWidth={2.6} />
        </div>
        <Pill bg={hex.sand} color={hex.accentDeep} size={34} weight={700} style={{ border: `2px solid ${hex.sandDeep}` }}>{DOMAIN}/plan-finder</Pill>
      </div>
      <div style={{ position: "absolute", left: M, right: M, top: 1290, borderRadius: 36, padding: "34px 40px", boxSizing: "border-box", textAlign: "center", opacity: rest, ...card }}>
        <div style={{ display: "flex", justifyContent: "center" }}><Footer boxW={inner - 80} size={34} align="center" color={hex.ink} /></div>
      </div>
    </Shell>
  );
};

/* ---------------- GlossaryShort ---------------- */

export type GlossaryShortProps = { slug: string };

const GlossaryIntro: React.FC<{ slug: string }> = ({ slug }) => {
  const t = getTerm(slug);
  const p = paletteFor(t.slug);
  const a = useIn(0.1, 0.8), b = useIn(0.5, 0.8);
  const fit = fitTextOnNLines({ text: t.term, maxLines: 3, maxBoxWidth: W - 2 * M, fontFamily: "Inter", fontWeight: 800, maxFontSize: 150 });
  return (
    <Shell p={p} seed={t.slug.length}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 500, display: "flex", justifyContent: "center", scale: String(0.85 + 0.15 * a), opacity: a }}>
        <IconTile icon={iconForTerm(t)} size={300} p={p} radius={80} />
      </div>
      <div style={{ position: "absolute", left: M, right: M, top: 920, textAlign: "center", opacity: b, translate: `0px ${(1 - b) * 24}px` }}>
        <div style={{ display: "flex", justifyContent: "center" }}><Kicker text={KICKER} size={28} color={colorOf(p.main === "gold" ? "clay" : p.main === "sage" ? "accent" : p.main)} /></div>
        <div style={{ marginTop: 40, fontSize: fit.fontSize, fontWeight: 800, color: hex.ink, letterSpacing: "-0.02em", lineHeight: 1.08 }}>
          {fit.lines.map((l, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>)}
        </div>
        {t.acronym && t.acronym.toLowerCase() !== t.term.toLowerCase() && (
          <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}><Pill bg={hex[p.tint]} color={hex.accentDeep} size={32}>Also called {t.acronym}</Pill></div>
        )}
      </div>
    </Shell>
  );
};

const GlossaryDefinition: React.FC<{ slug: string; plan: Plan }> = ({ slug, plan }) => {
  const t = getTerm(slug);
  const p = paletteFor(t.slug);
  const inner = W - 2 * M;
  const related = t.related.map((s) => glossary.find((g) => g.slug === s)).filter(Boolean).slice(0, 3);
  const chipsAt = plan.revealEnd + 0.2;
  const head = useIn(0.1, 0.6);
  const fit = phraseFit(plan, inner - 104, 760, 62);
  return (
    <Shell p={p} seed={t.slug.length}>
      <div style={{ position: "absolute", left: M, right: M, top: 260, bottom: 220, display: "flex", flexDirection: "column", justifyContent: "center", gap: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: head }}>
          <IconTile icon={iconForTerm(t)} size={120} p={p} radius={34} />
          <div style={{ flex: 1, minWidth: 0 }}><OneLine text={t.term} boxW={inner - 150} maxSize={68} weight={800} /></div>
        </div>
        <div style={{ borderRadius: 48, padding: 52, boxSizing: "border-box", height: fit.height + 104, ...card }}>
          <Phrases plan={plan} fit={fit} />
        </div>
        <div style={{ height: 150 }}>
          {related.length > 0 && <RelatedChips names={related.map((r) => r!.term)} at={chipsAt} boxW={inner} />}
        </div>
      </div>
    </Shell>
  );
};

const RelatedChips: React.FC<{ names: string[]; at: number; boxW: number }> = ({ names, at, boxW }) => {
  const frame = useCurrentFrame();
  const label = interpolate(frame, [at * FPS, (at + 0.5) * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ width: boxW }}>
      <div style={{ opacity: label, fontSize: 26, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: hex.muted, marginBottom: 20 }}>Related terms</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {names.map((n, i) => {
          const o = interpolate(frame, [(at + 0.15 + i * 0.25) * FPS, (at + 0.65 + i * 0.25) * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
          return <div key={n} style={{ opacity: o, translate: `0px ${(1 - o) * 14}px` }}><Pill bg={hex.surface} color={hex.accentDeep} size={32} weight={700} style={{ border: `2px solid ${hex.line}`, maxWidth: boxW }}>{n}</Pill></div>;
        })}
      </div>
    </div>
  );
};

export const GlossaryShort: React.FC<GlossaryShortProps> = ({ slug }) => {
  const plan = glossaryPlan(slug);
  const t = getTerm(slug);
  const p = paletteFor(t.slug);
  return <Series plan={plan} bar>{[
    <GlossaryIntro key="a" slug={slug} />,
    <GlossaryDefinition key="b" slug={slug} plan={plan} />,
    <CtaScene key="c" lead={`Read more at ${DOMAIN}/glossary`} p={p} seed={t.slug.length} />,
  ]}</Series>;
};

/* ---------------- FaqShort ---------------- */

export type FaqShortProps = { index: number };

const FaqQuestion: React.FC<{ index: number }> = ({ index }) => {
  const f = getFaq(index);
  const p = paletteFor(f.category);
  const a = useIn(0.1, 0.8), b = useIn(0.6, 0.8);
  const inner = W - 2 * M;
  const q = fitParagraph(f.q, inner - 112, 620, 88, 46, 800, 1.16);
  return (
    <Shell p={p} seed={index}>
      <div style={{ position: "absolute", left: M, right: M, top: 260, bottom: 220, display: "flex", flexDirection: "column", justifyContent: "center", gap: 48 }}>
        <div style={{ opacity: a, display: "flex", alignItems: "center", gap: 24 }}>
          <IconTile icon={iconForCategory(f.category)} size={120} p={p} radius={34} />
          <Pill bg={hex[p.tint]} color={hex.accentDeep} size={32}>{f.category}</Pill>
        </div>
        <div style={{ borderRadius: 52, padding: "60px 56px", boxSizing: "border-box", opacity: b, translate: `0px ${(1 - b) * 24}px`, ...card }}>
          <Kicker text="Common question" size={26} color={colorOf(p.main === "gold" ? "clay" : p.main === "sage" ? "accent" : p.main)} />
          <div style={{ height: 36 }} />
          <Paragraph fit={q} weight={800} />
        </div>
      </div>
    </Shell>
  );
};

const FaqAnswer: React.FC<{ index: number; plan: Plan }> = ({ index, plan }) => {
  const f = getFaq(index);
  const p = paletteFor(f.category);
  const inner = W - 2 * M;
  const head = useIn(0.1, 0.6);
  const q = fitParagraph(f.q, inner, 150, 40, 28, 700, 1.25);
  const fit = phraseFit(plan, inner - 104, 900, 56);
  return (
    <Shell p={p} seed={index}>
      <div style={{ position: "absolute", left: M, right: M, top: 260, bottom: 220, display: "flex", flexDirection: "column", justifyContent: "center", gap: 44 }}>
        <div style={{ opacity: head }}><Paragraph fit={q} weight={700} color={hex.muted} /></div>
        <div style={{ borderRadius: 48, padding: 52, boxSizing: "border-box", ...card }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: hex.muted, marginBottom: 28 }}>Short answer</div>
          <Phrases plan={plan} fit={fit} />
        </div>
      </div>
    </Shell>
  );
};

export const FaqShort: React.FC<FaqShortProps> = ({ index }) => {
  const plan = faqPlan(index);
  const f = getFaq(index);
  const p = paletteFor(f.category);
  return <Series plan={plan} bar>{[
    <FaqQuestion key="a" index={index} />,
    <FaqAnswer key="b" index={index} plan={plan} />,
    <CtaScene key="c" lead={`Read more at ${DOMAIN}/faq`} p={p} seed={index} />,
  ]}</Series>;
};

/* ---------------- shared timeline ---------------- */

const Series: React.FC<{ plan: Plan; children: React.ReactNode[]; bar?: boolean }> = ({ plan, children }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const tm = linearTiming({ durationInFrames: TRANS, easing: Easing.inOut(Easing.quad) });
  return (
    <AbsoluteFill style={{ background: hex.paper }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={plan.scenes[0]} premountFor={fps}>{children[0]}</TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={tm} />
        <TransitionSeries.Sequence durationInFrames={plan.scenes[1]} premountFor={fps}>{children[1]}</TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={tm} />
        <TransitionSeries.Sequence durationInFrames={plan.scenes[2]} premountFor={fps}>{children[2]}</TransitionSeries.Sequence>
      </TransitionSeries>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 8, width: `${(frame / plan.total) * 100}%`, background: hex.accent, opacity: 0.85 }} />
    </AbsoluteFill>
  );
};
