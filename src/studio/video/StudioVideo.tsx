/**
 * Social video studio template: renders a director's VideoPlan as a 16:9 long video or a 9:16 short.
 * One layout per SceneTemplate, cross-fades between scenes, burned-in word-paged captions, the plan's
 * disclaimer on every frame, and optional voiceover audio. Uses only `remotion` (no layout-utils or
 * transitions packages) so the site can preview it with @remotion/player, and the video/ project can
 * render it with the same code.
 *
 * Visual rules (docs/visual-style.md): flat shapes and icons from our library, faceless people, no photos.
 */
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene, SceneTemplate, VideoPlan } from "../../server/studio/types";
import { hex, type ColorName } from "../../components/visuals/tokens";
import { iconPaths } from "../../components/visuals/icons/paths";
import { FONT, fitLine, fitParagraph, type Fit } from "./fit";
import { buildCaptionPages, type CaptionPage } from "./captions";
import { sceneFrames, sceneStarts } from "./timing";

export type StudioVideoProps = {
  plan: VideoPlan;
  /** Poster stills: hide the captions. */
  poster?: boolean;
};

const CROSSFADE = 10; // frames
const ease = Easing.bezier(0.16, 1, 0.3, 1);

/* ---------------- geometry ---------------- */

type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  W: number;
  H: number;
  vertical: boolean;
  /** Font unit: 1 at 1080 px on the short side. */
  u: number;
  top: Box; // brand and chapter row
  stage: Box; // scene content
  cap: Box; // captions
  disc: Box; // disclaimer
};

/**
 * 9:16 keeps all text out of the bottom 20% and the right 12% (Shorts and Reels buttons and caption UI),
 * and below the top 6% (status and camera icons). 16:9 uses ordinary title-safe margins.
 */
function geometry(W: number, H: number): Geo {
  const vertical = H > W;
  const u = Math.min(W, H) / 1080;
  if (vertical) {
    const L = W * 0.074, R = W * 0.88;
    const w = R - L;
    return {
      W, H, vertical, u,
      top: { x: L, y: H * 0.06, w, h: 64 * u },
      stage: { x: L, y: H * 0.115, w, h: H * 0.5 },
      cap: { x: L, y: H * 0.625, w, h: H * 0.115 },
      disc: { x: L, y: H * 0.748, w, h: H * 0.044 },
    };
  }
  const L = W * 0.0625;
  const w = W - 2 * L;
  return {
    W, H, vertical, u,
    top: { x: L, y: H * 0.05, w, h: 48 * u },
    stage: { x: L, y: H * 0.14, w, h: H * 0.575 },
    cap: { x: L + w * 0.1, y: H * 0.735, w: w * 0.8, h: H * 0.15 },
    disc: { x: L, y: H * 0.905, w, h: H * 0.06 },
  };
}

/* ---------------- small pieces ---------------- */

type Tone = { main: ColorName; tint: ColorName; deep: ColorName };
const TONES: Record<SceneTemplate, Tone> = {
  title: { main: "accent", tint: "accentTint", deep: "accentDeep" },
  question: { main: "accent", tint: "accentTint", deep: "accentDeep" },
  statement: { main: "sage", tint: "sageTint", deep: "accentDeep" },
  points: { main: "accent", tint: "accentTint", deep: "accentDeep" },
  myth: { main: "clay", tint: "clayTint", deep: "accentDeep" },
  example: { main: "gold", tint: "goldTint", deep: "clay" },
  cta: { main: "accent", tint: "accentTint", deep: "accentDeep" },
};
const DEFAULT_ICON: Record<SceneTemplate, string> = {
  title: "scale", question: "question-mark", statement: "document", points: "list", myth: "magnifier", example: "family", cta: "arrow-right",
};

function Glyph({ name, size, color = "accent", tint = "accentTint", strokeWidth = 1.8 }: { name: string; size: number; color?: ColorName; tint?: ColorName | "none"; strokeWidth?: number }) {
  const draw = iconPaths[name] ?? iconPaths["question-mark"];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", flexShrink: 0 }}>
      <g stroke={hex[color]} color={hex[color]} fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {draw(tint === "none" ? "none" : hex[tint])}
      </g>
    </svg>
  );
}

function IconTile({ name, size, tone }: { name: string; size: number; tone: Tone }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: hex[tone.tint], display: "flex", alignItems: "center", justifyContent: "center", border: `${Math.max(2, size * 0.012)}px solid ${hex.surface}`, boxShadow: "0 10px 28px rgba(27,42,48,0.10)", flexShrink: 0 }}>
      <Glyph name={name} size={size * 0.58} color={tone.main === "gold" ? "clay" : tone.main} tint="surface" />
    </div>
  );
}

/** Lines measured by fitParagraph, drawn one per row so what was measured is what is drawn. */
function Lines({ fit, weight = 600, color = hex.ink, align = "left", style }: { fit: Fit; weight?: number; color?: string; align?: "left" | "center"; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: fit.size, lineHeight: fit.lineHeight, fontWeight: weight, color, textAlign: align, ...style }}>
      {fit.lines.map((l, i) => (
        <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>
      ))}
    </div>
  );
}

function Kicker({ text, size, color = hex.accent, maxW }: { text: string; size: number; color?: string; maxW: number }) {
  const s = fitLine(text.toUpperCase(), maxW - size * 2.2, size, 700);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s * 0.6, fontFamily: FONT, fontSize: s, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color, whiteSpace: "nowrap" }}>
      <span style={{ width: s * 1.6, height: Math.max(3, s * 0.16), borderRadius: 2, background: color, display: "block" }} />
      {text}
    </div>
  );
}

function Pill({ children, bg, color, size, style }: { children: ReactNode; bg: string; color: string; size: number; style?: CSSProperties }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.45, fontFamily: FONT, fontSize: size, fontWeight: 700, color, background: bg, padding: `${size * 0.4}px ${size * 0.9}px`, borderRadius: 999, whiteSpace: "nowrap", ...style }}>{children}</div>
  );
}

function Wordmark({ name, size, maxW }: { name: string; size: number; maxW: number }) {
  const s = fitLine(name, maxW - size * 2, size, 700);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s * 0.45, fontFamily: FONT, fontWeight: 700, fontSize: s, color: hex.ink, whiteSpace: "nowrap" }}>
      <svg width={s * 1.5} height={s * 1.5} viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
        <rect width="36" height="36" rx="10" fill={hex.accent} />
        <g transform="translate(6 6)" stroke={hex.surface} fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          {iconPaths.scale("none")}
        </g>
      </svg>
      <span>{name}</span>
    </div>
  );
}

const card: CSSProperties = { background: hex.surface, border: `2px solid ${hex.line}`, boxShadow: "0 14px 40px rgba(27,42,48,0.07)", boxSizing: "border-box" };

/** Soft paper backdrop with a few quiet shapes; the seed shifts them so scenes do not all look alike. */
function Backdrop({ g, tone, seed }: { g: Geo; tone: Tone; seed: number }) {
  const { W, H } = g;
  const m = Math.min(W, H);
  const flip = seed % 2 === 1;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <rect width={W} height={H} fill={hex.paper} />
      <circle cx={flip ? W * 0.06 : W * 0.96} cy={H * 0.04} r={m * 0.36} fill={hex[tone.tint]} opacity={0.7} />
      <circle cx={flip ? W * 0.97 : W * 0.03} cy={H * 0.99} r={m * 0.3} fill={hex.sand} opacity={0.85} />
      <circle cx={flip ? W * 0.86 : W * 0.15} cy={H * 0.93} r={m * 0.05} fill={hex.sageTint} />
      <circle cx={flip ? W * 0.72 : W * 0.9} cy={H * 0.975} r={m * 0.022} fill={hex.goldTint} />
    </svg>
  );
}

/** Faceless people (circle head, rounded body), the only way the library draws people. */
function FamilyArt({ w, h }: { w: number; h: number }) {
  const s = Math.min(w / 1.5, h);
  const person = (cx: number, base: number, size: number, color: string) => (
    <g>
      <circle cx={cx} cy={base - size * 0.62} r={size * 0.22} fill={color} />
      <path d={`M ${cx - size * 0.36} ${base} Q ${cx - size * 0.36} ${base - size * 0.36} ${cx} ${base - size * 0.36} Q ${cx + size * 0.36} ${base - size * 0.36} ${cx + size * 0.36} ${base} Z`} fill={color} />
    </g>
  );
  const ground = s * 0.86;
  const ox = (w - s * 1.5) / 2;
  return (
    <svg width={w} height={h} viewBox={`${-ox} ${-(h - s) / 2} ${w} ${h}`}>
      <rect x={s * 0.05} y={s * 0.05} width={s * 1.4} height={s * 0.9} rx={s * 0.08} fill={hex.sand} />
      {/* house */}
      <g transform={`translate(${s * 0.86} ${s * 0.2}) scale(${(s * 0.5) / 24})`} stroke={hex.accentDeep} fill="none" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        {iconPaths.house(hex.surface)}
      </g>
      <line x1={s * 0.12} x2={s * 1.38} y1={ground} y2={ground} stroke={hex.sandDeep} strokeWidth={s * 0.012} strokeLinecap="round" />
      {person(s * 0.3, ground, s * 0.42, hex.accent)}
      {person(s * 0.56, ground, s * 0.3, hex.gold)}
      {person(s * 0.78, ground, s * 0.38, hex.sage)}
    </svg>
  );
}

/* ---------------- animation helpers ---------------- */

function useIn(atSec: number, lenSec = 0.6) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [atSec * fps, (atSec + lenSec) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}
const rise = (p: number, d: number): CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * d}px)` });

/* ---------------- scene layouts ---------------- */

type SceneProps = { scene: Scene; plan: VideoPlan; g: Geo; index: number };

function TitleScene({ scene, g }: SceneProps) {
  const { stage: s, u, vertical } = g;
  const tone = TONES.title;
  const a = useIn(0.1, 0.8), b = useIn(0.5, 0.8);
  const iconSize = vertical ? 300 * u : 340 * u;
  const textW = vertical ? s.w : s.w * 0.6;
  const head = useMemo(() => fitParagraph(scene.headline, { w: textW, h: vertical ? s.h * 0.42 : s.h * 0.6, max: (vertical ? 118 : 104) * u, min: 40 * u, weight: 800, lineHeight: 1.08, maxLines: 4 }), [scene.headline, textW, s.h, u, vertical]);
  const body = useMemo(() => (scene.body ? fitParagraph(scene.body, { w: textW, h: s.h * 0.2, max: 46 * u, min: 26 * u, weight: 500, lineHeight: 1.3, maxLines: 3 }) : null), [scene.body, textW, s.h, u]);
  const text = (
    <div style={{ width: textW, ...rise(b, 24 * u) }}>
      <div style={{ width: 72 * u, height: 8 * u, borderRadius: 4 * u, background: hex.accent, marginBottom: 32 * u }} />
      <Lines fit={head} weight={800} style={{ letterSpacing: "-0.015em" }} />
      {body && <Lines fit={body} weight={500} color={hex.muted} style={{ marginTop: 28 * u }} />}
    </div>
  );
  const icon = <div style={{ transform: `scale(${0.85 + 0.15 * a})`, opacity: a }}><IconTile name={scene.icon ?? DEFAULT_ICON.title} size={iconSize} tone={tone} /></div>;
  return vertical ? (
    <div style={{ ...abs(s), display: "flex", flexDirection: "column", justifyContent: "center", gap: 56 * u }}>
      {icon}
      {text}
    </div>
  ) : (
    <div style={{ ...abs(s), display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {text}
      <div style={{ width: s.w * 0.36, display: "flex", justifyContent: "center" }}>{icon}</div>
    </div>
  );
}

function QuestionScene({ scene, g }: SceneProps) {
  const { stage: s, u, vertical } = g;
  const tone = TONES.question;
  const a = useIn(0.1, 0.7), b = useIn(0.4, 0.8);
  const pad = (vertical ? 64 : 72) * u;
  const iconSize = (vertical ? 150 : 170) * u;
  const innerW = vertical ? s.w - 2 * pad : s.w - 2 * pad - iconSize - 60 * u;
  const cardH = vertical ? s.h * 0.82 : s.h * 0.86;
  const head = useMemo(() => fitParagraph(scene.headline, { w: innerW, h: cardH - 2 * pad - (vertical ? iconSize + 110 * u : 80 * u), max: (vertical ? 92 : 84) * u, min: 38 * u, weight: 800, lineHeight: 1.14, maxLines: 5 }), [scene.headline, innerW, cardH, pad, iconSize, u, vertical]);
  return (
    <div style={{ ...abs(s), display: "flex", alignItems: "center" }}>
      <div style={{ ...card, width: s.w, height: cardH, borderRadius: 52 * u, padding: pad, display: "flex", flexDirection: vertical ? "column" : "row", alignItems: vertical ? "flex-start" : "center", justifyContent: vertical ? "center" : "flex-start", gap: (vertical ? 48 : 60) * u, ...rise(a, 30 * u) }}>
        <IconTile name={scene.icon ?? DEFAULT_ICON.question} size={iconSize} tone={tone} />
        <div style={rise(b, 18 * u)}>
          <Kicker text="Common question" size={(vertical ? 30 : 26) * u} maxW={innerW} />
          <div style={{ height: 30 * u }} />
          <Lines fit={head} weight={800} style={{ letterSpacing: "-0.01em" }} />
        </div>
      </div>
    </div>
  );
}

function StatementScene({ scene, g }: SceneProps) {
  const { stage: s, u, vertical } = g;
  const tone = TONES.statement;
  const a = useIn(0.1, 0.7), b = useIn(0.6, 0.8);
  const iconSize = (vertical ? 200 : 260) * u;
  const textW = vertical ? s.w : s.w * 0.66;
  const headH = vertical ? s.h * 0.4 : s.h * 0.5;
  const head = useMemo(() => fitParagraph(scene.headline, { w: textW, h: headH, max: (vertical ? 100 : 88) * u, min: 38 * u, weight: 800, lineHeight: 1.1, maxLines: 4 }), [scene.headline, textW, headH, u, vertical]);
  const bodyBoxW = textW - 2 * 44 * u;
  const body = useMemo(() => (scene.body ? fitParagraph(scene.body, { w: bodyBoxW, h: (vertical ? s.h * 0.3 : s.h * 0.32) - 2 * 36 * u, max: (vertical ? 48 : 42) * u, min: 24 * u, weight: 500, lineHeight: 1.34 }) : null), [scene.body, bodyBoxW, s.h, u, vertical]);
  const text = (
    <div style={{ width: textW }}>
      <div style={rise(a, 24 * u)}><Lines fit={head} weight={800} style={{ letterSpacing: "-0.01em" }} /></div>
      {body && (
        <div style={{ ...card, marginTop: 40 * u, borderRadius: 36 * u, padding: `${36 * u}px ${44 * u}px`, borderLeft: `${10 * u}px solid ${hex[tone.main]}`, ...rise(b, 20 * u) }}>
          <Lines fit={body} weight={500} color={hex.ink} />
        </div>
      )}
    </div>
  );
  const icon = <div style={{ opacity: a, transform: `scale(${0.85 + 0.15 * a})` }}><IconTile name={scene.icon ?? DEFAULT_ICON.statement} size={iconSize} tone={tone} /></div>;
  return vertical ? (
    <div style={{ ...abs(s), display: "flex", flexDirection: "column", justifyContent: "center", gap: 48 * u }}>{icon}{text}</div>
  ) : (
    <div style={{ ...abs(s), display: "flex", alignItems: "center", justifyContent: "space-between" }}>{text}<div style={{ width: s.w * 0.3, display: "flex", justifyContent: "center" }}>{icon}</div></div>
  );
}

/** One font size for every point, so the list reads as a set; each point wraps to at most 3 lines. */
function fitPoints(points: string[], w: number, h: number, max: number, min: number) {
  const lh = 1.22;
  for (let size = max; size >= min; size -= 2) {
    const bubble = size * 1.4;
    const padY = size * 0.36, padX = size * 0.6, gap = size * 0.36;
    const textW = (w - bubble - padX * 3) * 0.97;
    const fits = points.map((p) => fitParagraph(p, { w: textW, h: size * lh * 3, max: size, min: size, weight: 650, lineHeight: lh, maxLines: 3 }));
    if (fits.some((f) => f.size !== size)) continue;
    const rows = fits.map((f) => Math.max(bubble, f.height) + padY * 2);
    const total = rows.reduce((x, y) => x + y, 0) + gap * (points.length - 1);
    if (total <= h) return { size, bubble, padY, padX, gap, fits, rows };
  }
  const size = min;
  const bubble = size * 1.4, padY = size * 0.3, padX = size * 0.5, gap = size * 0.3;
  const fits = points.map((p) => fitParagraph(p, { w: (w - bubble - padX * 3) * 0.97, h: (h - gap * (points.length - 1)) / points.length - padY * 2, max: size, min: 8, weight: 650, lineHeight: lh }));
  return { size, bubble, padY, padX, gap, fits, rows: fits.map((f) => Math.max(bubble, f.height) + padY * 2) };
}

function PointsScene({ scene, g }: SceneProps) {
  const { stage: s, u, vertical } = g;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = TONES.points;
  const points = (scene.points?.length ? scene.points : [scene.body ?? scene.headline]).slice(0, 5);
  const headIn = useIn(0.05, 0.6);
  const headH = (vertical ? 190 : 130) * u;
  const head = useMemo(() => fitParagraph(scene.headline, { w: s.w - 140 * u, h: headH, max: (vertical ? 76 : 70) * u, min: 34 * u, weight: 800, lineHeight: 1.1, maxLines: 2 }), [scene.headline, s.w, headH, u, vertical]);
  const listTop = Math.max(head.height, 70 * u) + 44 * u;
  const listH = s.h - listTop;
  const layout = fitPoints(points, vertical ? s.w : s.w * 0.82, listH, (vertical ? 58 : 54) * u, 26 * u);
  // Reveal points one by one through the first part of the scene, leaving a hold at the end.
  const span = Math.max(0.6, Math.min(scene.durationSec - 2.2, points.length * 2.2));
  const at = (i: number) => 0.6 + (points.length <= 1 ? 0 : (i * span) / points.length);
  const numbered = scene.icon === "list" || /step/i.test(scene.headline);
  const listContentH = layout.rows.reduce((x, y) => x + y, 0) + layout.gap * (points.length - 1);
  return (
    <div style={abs(s)}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 * u, ...rise(headIn, 18 * u) }}>
        <Glyph name={scene.icon ?? DEFAULT_ICON.points} size={70 * u} color={tone.main} tint={tone.tint} />
        <Lines fit={head} weight={800} />
      </div>
      <div style={{ position: "absolute", left: 0, top: listTop + Math.max(0, (listH - listContentH) / 2) * (vertical ? 0.5 : 0.3), width: vertical ? s.w : s.w * 0.82, display: "flex", flexDirection: "column", gap: layout.gap }}>
        {points.map((p, i) => {
          const t = interpolate(frame, [at(i) * fps, (at(i) + 0.55) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
          const current = frame / fps >= at(i) && (i === points.length - 1 || frame / fps < at(i + 1));
          const f = layout.fits[i];
          return (
            <div key={i} style={{ ...card, height: layout.rows[i], borderRadius: layout.size * 0.7, padding: `${layout.padY}px ${layout.padX}px`, display: "flex", alignItems: "center", gap: layout.padX, opacity: t, transform: `translateX(${(1 - t) * 40 * u}px)`, borderColor: current ? hex[tone.main] : hex.line, borderWidth: current ? 3 : 2 }}>
              <div style={{ width: layout.bubble, height: layout.bubble, borderRadius: layout.bubble / 2, background: current ? hex[tone.main] : hex[tone.tint], color: current ? hex.surface : hex[tone.deep], display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 800, fontSize: layout.size * 0.85, flexShrink: 0 }}>
                {numbered ? i + 1 : <Glyph name="check" size={layout.bubble * 0.62} color={current ? "surface" : tone.main} tint="none" strokeWidth={2.6} />}
              </div>
              <Lines fit={f} weight={650} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MythScene({ scene, g }: SceneProps) {
  const { stage: s, u, vertical } = g;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // points[0] is the myth and points[1] the fact; without points, headline is the myth and body the fact.
  const myth = scene.points?.[0] ?? scene.headline;
  const fact = scene.points?.[1] ?? scene.body ?? "";
  const factAt = Math.min(Math.max(1.6, scene.durationSec * 0.38), scene.durationSec - 1.5);
  const a = useIn(0.1, 0.6);
  const b = useIn(factAt, 0.7);
  const dim = interpolate(frame, [factAt * fps, (factAt + 0.6) * fps], [1, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const gap = (vertical ? 36 : 48) * u;
  const pw = vertical ? s.w : (s.w - gap) / 2;
  const ph = vertical ? (s.h - gap - 70 * u) / 2 : s.h * 0.86;
  const pad = 52 * u;
  const labelH = 84 * u;
  const fitPanel = (t: string) => fitParagraph(t, { w: pw - 2 * pad, h: ph - 2 * pad - labelH, max: (vertical ? 66 : 56) * u, min: 28 * u, weight: 700, lineHeight: 1.2 });
  const mf = fitPanel(myth);
  const ff = fitPanel(fact);
  const panel = (kind: "Myth" | "Fact", f: Fit, p: number, extra: CSSProperties) => {
    const isMyth = kind === "Myth";
    const main = isMyth ? hex.clay : hex.sage;
    return (
      <div style={{ ...card, width: pw, height: ph, borderRadius: 44 * u, padding: pad, background: isMyth ? hex.clayTint : hex.sageTint, border: `3px solid ${main}`, display: "flex", flexDirection: "column", ...rise(p, 26 * u), ...extra }}>
        <div style={{ height: labelH, display: "flex", alignItems: "flex-start" }}>
          <Pill bg={main} color={hex.surface} size={34 * u}>
            {isMyth ? (
              <svg width={30 * u} height={30 * u} viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke={hex.surface} strokeWidth={3} strokeLinecap="round" /></svg>
            ) : (
              <Glyph name="check" size={30 * u} color="surface" tint="none" strokeWidth={3} />
            )}
            {kind}
          </Pill>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <Lines fit={f} weight={700} color={hex.ink} />
        </div>
      </div>
    );
  };
  return (
    <div style={abs(s)}>
      <div style={{ height: 70 * u, display: vertical ? "flex" : "none", alignItems: "center", opacity: a }}>
        <Kicker text="Myth or fact?" size={30 * u} maxW={s.w} color={hex.clay} />
      </div>
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap, alignItems: "center", height: vertical ? undefined : s.h }}>
        {panel("Myth", mf, a, { opacity: a * dim })}
        {panel("Fact", ff, b, {})}
      </div>
    </div>
  );
}

function ExampleScene({ scene, g }: SceneProps) {
  const { stage: s, u, vertical } = g;
  const tone = TONES.example;
  const a = useIn(0.1, 0.7), b = useIn(0.5, 0.8), c2 = useIn(1.0, 0.8);
  const artW = vertical ? s.w : s.w * 0.4;
  const artH = vertical ? s.h * 0.3 : s.h * 0.78;
  const textW = vertical ? s.w : s.w * 0.55;
  const tagH = 80 * u;
  const headH = (vertical ? 200 : 170) * u;
  const head = useMemo(() => fitParagraph(scene.headline, { w: textW, h: headH, max: (vertical ? 80 : 72) * u, min: 34 * u, weight: 800, lineHeight: 1.1, maxLines: 2 }), [scene.headline, textW, headH, u, vertical]);
  const bodyH = (vertical ? s.h - artH - 40 * u : s.h) - tagH - head.height - 40 * u - 2 * 40 * u - 30 * u;
  const body = useMemo(() => (scene.body ? fitParagraph(scene.body, { w: textW - 2 * 44 * u, h: bodyH, max: (vertical ? 48 : 40) * u, min: 22 * u, weight: 500, lineHeight: 1.34 }) : null), [scene.body, textW, bodyH, u, vertical]);
  const text = (
    <div style={{ width: textW }}>
      <div style={{ height: tagH, opacity: a }}>
        {scene.fictional ? (
          <Pill bg={hex.goldTint} color={hex.clay} size={30 * u} style={{ border: `2px solid ${hex.gold}` }}>
            <Glyph name="pen" size={30 * u} color="clay" tint="none" strokeWidth={2.2} />
            Fictional example
          </Pill>
        ) : (
          <Kicker text="Example" size={28 * u} maxW={textW} color={hex.clay} />
        )}
      </div>
      <div style={rise(b, 20 * u)}><Lines fit={head} weight={800} /></div>
      {body && (
        <div style={{ ...card, marginTop: 40 * u, borderRadius: 36 * u, padding: `${40 * u}px ${44 * u}px`, ...rise(c2, 20 * u) }}>
          <Lines fit={body} weight={500} />
        </div>
      )}
    </div>
  );
  const art = (
    <div style={{ width: artW, height: artH, opacity: a, transform: `scale(${0.94 + 0.06 * a})` }}>
      {scene.icon && scene.icon !== "family" && !vertical ? (
        <div style={{ position: "relative", width: artW, height: artH }}>
          <FamilyArt w={artW} h={artH} />
          <div style={{ position: "absolute", right: 0, top: 0 }}><IconTile name={scene.icon} size={120 * u} tone={tone} /></div>
        </div>
      ) : (
        <FamilyArt w={artW} h={artH} />
      )}
    </div>
  );
  return vertical ? (
    <div style={{ ...abs(s), display: "flex", flexDirection: "column", gap: 40 * u }}>{art}{text}</div>
  ) : (
    <div style={{ ...abs(s), display: "flex", alignItems: "center", justifyContent: "space-between" }}>{art}{text}</div>
  );
}

function CtaScene({ scene, plan, g }: SceneProps) {
  const { stage: s, u, vertical } = g;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = useIn(0.1, 0.7), b = useIn(0.6, 0.7), c2 = useIn(1.1, 0.7);
  const pulse = interpolate(frame, [fps * 1.8, fps * 2.3, fps * 2.8], [1, 1.035, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const e = plan.endCard;
  const head = useMemo(() => fitParagraph(scene.headline, { w: s.w, h: (vertical ? 260 : 200) * u, max: (vertical ? 92 : 84) * u, min: 36 * u, weight: 800, lineHeight: 1.1, maxLines: 3 }), [scene.headline, s.w, u, vertical]);
  const urlSize = fitLine(e.url, (vertical ? s.w : s.w * 0.7) - 2 * 56 * u - 70 * u, (vertical ? 52 : 50) * u, 700);
  const addr = fitParagraph(e.officeAddress, { w: s.w - 2 * 48 * u, h: 100 * u, max: 34 * u, min: 20 * u, weight: 500, lineHeight: 1.3, maxLines: 2 });
  const label = fitLine(e.advertisingLabel, s.w - 2 * 48 * u, 28 * u, 600);
  return (
    <div style={{ ...abs(s), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: (vertical ? 52 : 30) * u, textAlign: "center" }}>
      <div style={{ ...rise(a, 20 * u) }}>
        <IconTile name="check-circle" size={(vertical ? 170 : 110) * u} tone={TONES.cta} />
      </div>
      <div style={rise(a, 20 * u)}><Lines fit={head} weight={800} align="center" /></div>
      <div style={{ transform: `scale(${pulse})`, opacity: b, display: "flex", alignItems: "center", gap: 22 * u, background: hex.accent, color: hex.surface, borderRadius: 999, padding: `${30 * u}px ${56 * u}px`, fontFamily: FONT, fontWeight: 700, fontSize: urlSize, whiteSpace: "nowrap", boxShadow: "0 18px 40px rgba(31,102,112,0.28)" }}>
        {e.url}
        <Glyph name="arrow-right" size={urlSize * 0.95} color="surface" tint="none" strokeWidth={2.6} />
      </div>
      <div style={{ ...card, borderRadius: 36 * u, padding: `${30 * u}px ${48 * u}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * u, maxWidth: s.w, ...rise(c2, 16 * u) }}>
        <Wordmark name={e.firmName} size={(vertical ? 40 : 36) * u} maxW={s.w - 2 * 48 * u} />
        <Lines fit={addr} weight={500} color={hex.ink} align="center" />
        <div style={{ fontFamily: FONT, fontSize: label, fontWeight: 600, color: hex.muted, whiteSpace: "nowrap" }}>{e.advertisingLabel}</div>
      </div>
    </div>
  );
}

const abs = (b: Box): CSSProperties => ({ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h });

const LAYOUTS: Record<SceneTemplate, (p: SceneProps) => ReactNode> = {
  title: TitleScene,
  question: QuestionScene,
  statement: StatementScene,
  points: PointsScene,
  myth: MythScene,
  example: ExampleScene,
  cta: CtaScene,
};

/* ---------------- frame chrome ---------------- */

function SceneFrame({ scene, plan, g, index, fadeIn }: SceneProps & { fadeIn: boolean }) {
  const frame = useCurrentFrame();
  const o = fadeIn ? interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) }) : 1;
  const tone = TONES[scene.template] ?? TONES.statement;
  const Layout = LAYOUTS[scene.template] ?? StatementScene;
  const showChapter = plan.format === "long" && !g.vertical && !!scene.chapter;
  return (
    <AbsoluteFill style={{ opacity: o, fontFamily: FONT }}>
      <Backdrop g={g} tone={tone} seed={index} />
      {/* top row: chapter kicker (long video) and firm wordmark */}
      <div style={{ ...abs(g.top), display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {showChapter ? <Kicker text={scene.chapter!} size={24 * g.u} maxW={g.top.w * 0.6} /> : g.vertical ? null : <span />}
        {scene.template !== "cta" && <div style={{ opacity: 0.9 }}><Wordmark name={plan.endCard.firmName} size={(g.vertical ? 30 : 24) * g.u} maxW={g.top.w * (showChapter ? 0.35 : 0.8)} /></div>}
      </div>
      <Layout scene={scene} plan={plan} g={g} index={index} />
    </AbsoluteFill>
  );
}

function Captions({ pages, g }: { pages: CaptionPage[]; g: Geo }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const page = pages.find((p) => ms >= p.startMs && ms < p.endMs);
  const box = g.cap;
  const padX = 36 * g.u, padY = 18 * g.u;
  const fit = useMemo(
    () => {
      if (!page) return null;
      const o = { w: box.w - 2 * padX, h: box.h - 2 * padY, max: (g.vertical ? 68 : 50) * g.u, min: 28 * g.u, weight: 800, lineHeight: 1.22 };
      // One line when it stays near full size; otherwise two balanced-by-width lines.
      const one = fitParagraph(page.text, { ...o, maxLines: 1 });
      return one.size >= o.max * 0.82 ? one : fitParagraph(page.text, { ...o, maxLines: 2 });
    },
    [page, box.w, box.h, padX, padY, g.u, g.vertical],
  );
  if (!page || !fit) return null;
  const p = interpolate(ms - page.startMs, [0, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let cur = 0;
  page.tokens.forEach((t, i) => { if (ms >= t.fromMs) cur = i; });
  let wi = 0;
  return (
    <div style={{ ...abs(box), display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ padding: `${padY}px ${padX}px`, borderRadius: 26 * g.u, background: "rgba(255,255,255,0.97)", border: `2px solid ${hex.line}`, boxShadow: "0 8px 26px rgba(27,42,48,0.12)", fontFamily: FONT, fontWeight: 800, fontSize: fit.size, lineHeight: fit.lineHeight, color: hex.ink, textAlign: "center", opacity: p, transform: `scale(${0.96 + 0.04 * p})` }}>
        {fit.lines.map((line, li) => (
          <div key={li} style={{ whiteSpace: "nowrap" }}>
            {line.split(" ").map((w, j) => {
              const i = wi++;
              const on = i === cur;
              return (
                <span key={j}>
                  {j > 0 ? " " : ""}
                  <span style={{ borderRadius: fit.size * 0.18, background: on ? hex.accentTint : "transparent", color: on ? hex.accentDeep : i > cur ? hex.muted : hex.ink, boxShadow: on ? `0 0 0 ${fit.size * 0.08}px ${hex.accentTint}` : undefined }}>{w}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Disclaimer({ text, g }: { text: string; g: Geo }) {
  const fit = useMemo(() => fitParagraph(text, { w: g.disc.w, h: g.disc.h, max: (g.vertical ? 26 : 22) * g.u, min: 14 * g.u, weight: 500, lineHeight: 1.3, maxLines: 2 }), [text, g]);
  return (
    <div style={{ ...abs(g.disc), display: "flex", alignItems: "center", justifyContent: g.vertical ? "flex-start" : "center" }}>
      <Lines fit={fit} weight={500} color={hex.muted} align={g.vertical ? "left" : "center"} />
    </div>
  );
}

/* ---------------- composition ---------------- */

export function StudioVideo({ plan, poster }: StudioVideoProps) {
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const g = useMemo(() => geometry(width, height), [width, height]);
  const pages = useMemo(() => buildCaptionPages(plan), [plan]);
  const starts = sceneStarts(plan);
  return (
    <AbsoluteFill style={{ background: hex.paper, fontFamily: FONT }}>
      {plan.scenes.map((scene, i) => {
        const len = sceneFrames(scene, plan.fps);
        const last = i === plan.scenes.length - 1;
        return (
          // Each scene runs CROSSFADE frames past its slot while the next one fades in over it.
          <Sequence key={scene.id + i} name={`${i + 1} ${scene.template}`} from={starts[i]} durationInFrames={len + (last ? 0 : CROSSFADE)} premountFor={fps}>
            <SceneFrame scene={scene} plan={plan} g={g} index={i} fadeIn={i > 0} />
          </Sequence>
        );
      })}
      {!poster && <Captions pages={pages} g={g} />}
      <Disclaimer text={plan.disclaimer} g={g} />
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 8 * g.u, width: `${(frame / Math.max(1, durationInFrames - 1)) * 100}%`, background: hex.accent, opacity: 0.85 }} />
      {plan.audioSrc ? <Audio src={plan.audioSrc} /> : null}
    </AbsoluteFill>
  );
}
