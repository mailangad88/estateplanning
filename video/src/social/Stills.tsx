import { AbsoluteFill } from "remotion";
import { hex } from "../../../src/components/visuals/tokens";
import { FONT } from "../visual/anim";
import {
  DOMAIN, KICKER, getFaq, getTerm, iconForCategory, iconForTerm, paletteFor, shorten,
  type CarouselSlide,
} from "./data";
import { Backdrop, Footer, Glyph, IconTile, Kicker, Paragraph, Pill, Wordmark, card, colorOf, fitParagraph } from "./ui";
import { fitTextOnNLines } from "@remotion/layout-utils";

const fitLines = (text: string, boxW: number, maxLines: number, maxSize: number, weight = 700) => {
  const r = fitTextOnNLines({ text, maxLines, maxBoxWidth: boxW, fontFamily: "Inter", fontWeight: weight, maxFontSize: maxSize });
  return { size: Math.max(28, r.fontSize), lines: r.lines };
};

/* ---------------- Glossary card (1080x1350 and 1080x1080) ---------------- */

export type GlossaryCardProps = { slug: string; width: number; height: number };

export const GlossaryCard: React.FC<GlossaryCardProps> = ({ slug, width: W, height: H }) => {
  const t = getTerm(slug);
  const p = paletteFor(t.slug);
  const tall = H > W;
  const M = 72;
  const cardX = M, cardW = W - 2 * M;
  const cardY = tall ? 190 : 160;
  const footerY = H - 78;
  const cardH = footerY - 36 - cardY;
  const inner = cardW - 2 * 56;
  const iconSize = tall ? 190 : 150;
  const title = t.term;
  const titleFit = fitLines(title, inner - iconSize * 0.3, 2, tall ? 112 : 92);
  const titleH = titleFit.size * 1.1 * titleFit.lines.length;
  const fixed = 112 + 30 + 56 + titleH + (t.acronym ? 68 : 0) + 4 + 2 * (tall ? 34 : 24) + 44 + 16;
  const defMaxH = cardH - fixed;
  const def = fitParagraph(t.definition, inner, defMaxH, tall ? 50 : 44, 24, 500, 1.42);
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop w={W} h={H} p={p} seed={t.slug.length} />
      <div style={{ position: "absolute", left: M, top: 64 }}><Wordmark size={tall ? 32 : 28} /></div>
      <div style={{ position: "absolute", left: cardX, top: cardY, width: cardW, height: cardH, borderRadius: 48, padding: 56, boxSizing: "border-box", display: "flex", flexDirection: "column", ...card }}>
        <div style={{ position: "absolute", right: 48, top: -iconSize * 0.4 }}><IconTile icon={iconForTerm(t)} size={iconSize} p={p} /></div>
        <Kicker text={KICKER} size={tall ? 24 : 21} color={colorOf(p.main === "gold" ? "clay" : p.main === "sage" ? "accent" : p.main)} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "28px 0" }}>
        <div style={{ color: hex.ink, fontWeight: 800, letterSpacing: "-0.02em", fontSize: titleFit.size, lineHeight: 1.1 }}>
          {titleFit.lines.map((l, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>)}
        </div>
        {t.acronym && t.acronym.toLowerCase() !== t.term.toLowerCase() && (
          <div style={{ marginTop: 20 }}><Pill bg={hex[p.tint]} color={hex.accentDeep} size={24}>Also called {t.acronym}</Pill></div>
        )}
        <div style={{ height: 4, width: 72, borderRadius: 2, background: hex[p.main], margin: `${tall ? 34 : 24}px 0` }} />
        <Paragraph fit={def} color={hex.ink} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 600, color: hex.accentDeep }}>{DOMAIN}/glossary</div>
          <Pill bg={hex[p.tint]} color={hex.accentDeep} size={20}>Glossary</Pill>
        </div>
      </div>
      <div style={{ position: "absolute", left: M, top: footerY }}><Footer boxW={cardW} size={23} /></div>
    </AbsoluteFill>
  );
};

/* ---------------- FAQ quote card (1080x1350 and 1200x627) ---------------- */

export type FaqCardProps = { index: number; width: number; height: number };

export const FaqQuoteCard: React.FC<FaqCardProps> = ({ index, width: W, height: H }) => {
  const f = getFaq(index);
  const p = paletteFor(f.category);
  const answer = shorten(f.a, 280);
  const wide = W > H;
  const catColor = colorOf(p.main === "gold" ? "clay" : p.main === "sage" ? "accent" : p.main);

  if (wide) {
    const M = 56;
    const colW = (W - 2 * M - 40) / 2;
    const top = 118;
    const bottom = H - 88;
    const q = fitParagraph(f.q, colW - 24, bottom - top - 40, 50, 28, 800, 1.18);
    const a = fitParagraph(answer, colW - 64, bottom - top - 130, 27, 19, 500, 1.4);
    return (
      <AbsoluteFill style={{ fontFamily: FONT }}>
        <Backdrop w={W} h={H} p={p} seed={index} />
        <div style={{ position: "absolute", left: M, top: 32 }}><Wordmark size={24} /></div>
        <div style={{ position: "absolute", right: M, top: 34 }}><Pill bg={hex[p.tint]} color={hex.accentDeep} size={18}>{f.category}</Pill></div>
        <div style={{ position: "absolute", left: M, top, width: colW, height: bottom - top, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Kicker text="Common question" size={17} color={catColor} />
          <div style={{ height: 18 }} />
          <Paragraph fit={q} weight={800} />
        </div>
        <div style={{ position: "absolute", left: M + colW + 40, top, width: colW, height: bottom - top, borderRadius: 32, boxSizing: "border-box", padding: 32, ...card }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: hex.muted, marginBottom: 14 }}>Short answer</div>
          <Paragraph fit={a} />
          <div style={{ position: "absolute", left: 32, bottom: 26, fontSize: 21, fontWeight: 700, color: hex.accentDeep }}>Read more at {DOMAIN}</div>
        </div>
        <div style={{ position: "absolute", left: M, top: H - 56 }}><Footer boxW={W - 2 * M} size={19} /></div>
      </AbsoluteFill>
    );
  }

  const M = 72;
  const inner = W - 2 * M;
  const q = fitParagraph(f.q, inner, 360, 76, 44, 800, 1.16);
  const a = fitParagraph(answer, inner - 96, 430, 44, 26, 500, 1.4);
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop w={W} h={H} p={p} seed={index} />
      <div style={{ position: "absolute", left: M, top: 64 }}><Wordmark size={32} /></div>
      <div style={{ position: "absolute", right: M, top: 70 }}><Pill bg={hex[p.tint]} color={hex.accentDeep} size={21}>{f.category}</Pill></div>
      <div style={{ position: "absolute", left: M, right: M, top: 170, bottom: 150, display: "flex", flexDirection: "column", justifyContent: "center", gap: 44 }}>
        <div>
          <Kicker text="Common question" size={22} color={catColor} />
          <div style={{ height: 30 }} />
          <Paragraph fit={q} weight={800} />
        </div>
        <div style={{ borderRadius: 40, boxSizing: "border-box", padding: "40px 48px", ...card }}>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: hex.muted, marginBottom: 20 }}>Short answer</div>
          <Paragraph fit={a} />
        </div>
        <div><Pill bg={hex.accent} color={hex.surface} size={28} weight={700}>Read more at {DOMAIN}</Pill></div>
      </div>
      <div style={{ position: "absolute", left: M, top: H - 78 }}><Footer boxW={inner} size={23} /></div>
    </AbsoluteFill>
  );
};

/* ---------------- Carousel slide (1080x1350) ---------------- */

export type CarouselProps = { category: string; slides: CarouselSlide[]; slide: number };

export const CarouselSlideView: React.FC<CarouselProps> = ({ category, slides, slide }) => {
  const W = 1080, H = 1350, M = 72, inner = W - 2 * M;
  const n = slides.length;
  const s = slides[Math.max(0, Math.min(n - 1, slide))];
  const kind = slide === 0 ? "cover" : slide === n - 1 ? "cta" : "qa";
  const p = paletteFor(category);
  const main = colorOf(p.main === "gold" ? "clay" : p.main === "sage" ? "accent" : p.main);
  const icon = iconForCategory(category);

  const header = (
    <>
      <div style={{ position: "absolute", left: M, top: 64 }}><Wordmark size={30} /></div>
      <div style={{ position: "absolute", right: M, top: 66 }}>
        <Pill bg={hex.surface} color={hex.accentDeep} size={24} style={{ border: `2px solid ${hex.line}` }}>{slide + 1}/{n}</Pill>
      </div>
    </>
  );
  const progress = (
    <div style={{ position: "absolute", left: M, top: H - 118, width: inner, display: "flex", gap: 8 }}>
      {slides.map((_, i) => <div key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: i <= slide ? hex[p.main] : hex.line }} />)}
    </div>
  );
  const footer = <div style={{ position: "absolute", left: M, top: H - 78 }}><Footer boxW={inner} size={23} /></div>;

  let body: React.ReactNode;
  if (kind === "cover") {
    const t = fitLines(s.heading, inner, 2, 150, 800);
    const sub = fitParagraph(s.body, inner, 120, 40, 28, 500, 1.4);
    body = (
      <>
        <div style={{ position: "absolute", left: M, top: 250 }}><IconTile icon={icon} size={240} p={p} radius={64} /></div>
        <div style={{ position: "absolute", left: M, top: 570, width: inner }}>
          <Kicker text="FAQ · Estate planning, explained" size={22} color={main} />
          <div style={{ marginTop: 34, fontSize: t.size, fontWeight: 800, color: hex.ink, letterSpacing: "-0.02em", lineHeight: 1.08 }}>
            {t.lines.map((l, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>)}
          </div>
          <div style={{ marginTop: 34 }}><Paragraph fit={sub} color={hex.muted} /></div>
        </div>
        <div style={{ position: "absolute", left: M, top: H - 220 }}>
          <Pill bg={hex[p.tint]} color={hex.accentDeep} size={26} weight={700}>Swipe <Glyph name="arrow-right" size={28} color="accentDeep" tint="none" strokeWidth={2.6} /></Pill>
        </div>
      </>
    );
  } else if (kind === "qa") {
    const q = fitParagraph(s.heading, inner, 330, 66, 38, 800, 1.16);
    const a = fitParagraph(s.body, inner - 96, 440, 44, 26, 500, 1.4);
    body = (
      <>
        <div style={{ position: "absolute", left: M, right: M, top: 170, bottom: 160, display: "flex", flexDirection: "column", justifyContent: "center", gap: 44 }}>
          <div>
            <Kicker text={category} size={21} color={main} />
            <div style={{ height: 28 }} />
            <Paragraph fit={q} weight={800} />
          </div>
          <div style={{ borderRadius: 40, padding: "40px 48px", boxSizing: "border-box", ...card }}>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: hex.muted, marginBottom: 20 }}>Short answer</div>
            <Paragraph fit={a} />
          </div>
        </div>
      </>
    );
  } else {
    const sub = fitParagraph(s.body, inner - 40, 120, 36, 26, 500, 1.4);
    const h = fitLines(s.heading, inner - 130, 2, 72, 700);
    body = (
      <>
        <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", justifyContent: "center" }}><IconTile icon="check-circle" size={200} p={{ main: "accent", tint: "accentTint", deep: "accentDeep" }} radius={56} /></div>
        <div style={{ position: "absolute", left: M, right: M, top: 560, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28, background: hex.accent, color: hex.surface, borderRadius: 56, padding: "38px 56px", fontWeight: 700, fontSize: h.size, lineHeight: 1.15, boxShadow: "0 18px 40px rgba(31,95,139,0.28)" }}>
            <div>{h.lines.map((l, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>)}</div>
            <Glyph name="arrow-right" size={h.size * 0.9} color="surface" tint="none" strokeWidth={2.6} />
          </div>
          <Pill bg={hex.sand} color={hex.accentDeep} size={32} weight={700} style={{ border: `2px solid ${hex.sandDeep}` }}>{DOMAIN}/plan-finder</Pill>
          <Paragraph fit={sub} align="center" color={hex.muted} />
        </div>
      </>
    );
  }
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop w={W} h={H} p={p} seed={slide} />
      {header}{body}{progress}{footer}
    </AbsoluteFill>
  );
};
