import { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { fitTextOnNLines } from "@remotion/layout-utils";
import { hex } from "../../src/components/visuals/tokens";
import { SIcon } from "./visual/icons";
import { FONT, SceneCtx, ease, useScene } from "./visual/anim";
import { CalendarStrip, CtaCard, Compare, Bars, Flow, Ladder, RowCells, Timeline, type Spec } from "./visual/templates";
import { defaultSpec, specs } from "./visual/specs";
import { ctx, videos, type Aspect, type Scene, type VideoScript } from "./data";
import { resolveDeep } from "./lib/resolve.js";
import { buildPages, HORIZONTAL_LIMITS, VERTICAL_LIMITS, type Page } from "./lib/captions.js";

export type ExplainerProps = {
  videoId: number;
  aspect: Aspect;
  /** Optional attorney voiceover. When set it plays as an <Audio>. URL or staticFile() path. */
  audioSrc?: string;
  /** Used for poster stills. */
  hideCaptions?: boolean;
};

const TRANSITION = 10;

type Geo = { W: number; H: number; vertical: boolean; head: { x: number; y: number; w: number; h: number; max: number; lines: number }; vis: { x: number; y: number; w: number; h: number }; cap: { y: number; h: number; w: number; max: number } };
const geo = (a: Aspect): Geo =>
  a === "16:9"
    ? { W: 1280, H: 720, vertical: false, head: { x: 80, y: 46, w: 1120, h: 120, max: 54, lines: 2 }, vis: { x: 80, y: 176, w: 1120, h: 320 }, cap: { y: 518, h: 150, w: 1000, max: 38 } }
    : { W: 720, H: 1280, vertical: true, head: { x: 60, y: 96, w: 600, h: 250, max: 58, lines: 3 }, vis: { x: 40, y: 366, w: 640, h: 410 }, cap: { y: 800, h: 190, w: 620, max: 40 } };

const frames = (s: number) => Math.round(s * 30);

function Headline({ text, g }: { text: string; g: Geo }) {
  const frame = useCurrentFrame();
  const opts = { text, maxLines: g.head.lines, maxBoxWidth: g.head.w, fontFamily: "Inter", fontWeight: 700 };
  let fit = fitTextOnNLines({ ...opts, maxFontSize: g.head.max });
  // keep multi-line headlines inside the headline band (clear of the visual panel)
  const cap = g.vertical ? 52 : 42;
  if (fit.lines.length > 1 && fit.fontSize > cap) fit = fitTextOnNLines({ ...opts, maxFontSize: cap });
  const p = interpolate(frame, [4, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <div style={{ position: "absolute", left: g.head.x, top: g.head.y, width: g.head.w, height: g.head.h, opacity: p, translate: `0px ${(1 - p) * 14}px`, fontFamily: FONT, color: hex.ink }}>
      <div style={{ width: 56, height: 6, borderRadius: 3, background: hex.accent, marginBottom: g.vertical ? 22 : 14 }} />
      {fit.lines.map((l, i) => (
        <div key={i} style={{ fontSize: fit.fontSize, fontWeight: 700, lineHeight: 1.12, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{l}</div>
      ))}
    </div>
  );
}

function renderSpec(spec: Spec, w: number, h: number) {
  switch (spec.k) {
    case "row": return <RowCells items={spec.items} w={w} h={h} check={spec.check} arrows={spec.arrows} active={spec.active} cols={spec.cols} />;
    case "flow": return <Flow from={spec.from} to={spec.to} label={spec.label} w={w} h={h} />;
    case "ladder": return <Ladder rows={spec.rows} w={w} h={h} />;
    case "timeline": return <Timeline ticks={spec.ticks} bars={spec.bars} zones={spec.zones} w={w} h={h} />;
    case "compare": return <Compare left={spec.left} right={spec.right} w={w} h={h} />;
    case "bars": return <Bars bars={spec.bars} line={spec.line} chips={spec.chips} arrow={spec.arrow} w={w} h={h} />;
    case "calendar": return <CalendarStrip days={spec.days} unit={spec.unit} ranges={spec.ranges} items={spec.items} check={spec.check} w={w} h={h} />;
  }
}

export function Wordmark({ size = 22, color = hex.ink }: { size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.5, fontFamily: FONT, fontWeight: 700, fontSize: size, color }}>
      <svg width={size * 1.5} height={size * 1.5} viewBox="0 0 36 36">
        <rect width="36" height="36" rx="10" fill={hex.accent} />
        <SIcon name="scale" x={6} y={6} size={24} color="surface" tint="none" strokeWidth={2.2} />
      </svg>
      <span>{ctx.config.firmName}</span>
    </div>
  );
}

function DisclaimerScene({ video, g }: { video: VideoScript; g: Geo }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 9], [0, 1], { extrapolateRight: "clamp" });
  const parts = video.disclaimer.text.split(/(?<=\.)\s+/).filter(Boolean);
  const label = video.disclaimer.attorneyAdvertisingLabel;
  const fs = g.vertical ? 38 : 34;
  return (
    <AbsoluteFill style={{ background: hex.sand, opacity: p, fontFamily: FONT, color: hex.ink, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: g.vertical ? 600 : 960, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: g.vertical ? 26 : 16 }}>
        <svg width={72} height={72} viewBox="0 0 24 24"><SIcon name="scale" size={24} /></svg>
        {parts.map((t, i) => (
          <div key={i} style={{ fontSize: i === 0 ? fs + 8 : fs - 4, fontWeight: i === 0 ? 700 : 500, lineHeight: 1.25 }}>{t}</div>
        ))}
        <div style={{ fontSize: fs - 8, fontWeight: 600, color: hex.muted }}>{label}</div>
        <div style={{ height: 8 }} />
        <Wordmark size={g.vertical ? 34 : 30} />
      </div>
    </AbsoluteFill>
  );
}

function SceneView({ video, scene, g }: { video: VideoScript; scene: Scene; g: Geo }) {
  const frame = useCurrentFrame();
  if (scene.id === video.disclaimer.sceneId) return <DisclaimerScene video={video} g={g} />;
  const isCta = scene.id === video.cta.cardSceneId;
  const raw = specs[video.id]?.[scene.id] ?? defaultSpec(scene.iconHints ?? []);
  const spec = resolveDeep(raw, ctx) as Spec;
  const dur = scene.durationSec;
  const push = interpolate(frame, [0, dur * 30], [1, 1.02], { extrapolateRight: "clamp" });
  const ctaIcon = (scene.iconHints ?? []).find((i) => !["button", "arrow-right", "arrow", "scale"].includes(i)) ?? "checklist";
  const display = video.cta.url.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
  const panel = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <SceneCtx.Provider value={{ dur, vertical: g.vertical }}>
      <AbsoluteFill style={{ background: hex.paper }}>
        <div style={{ position: "absolute", left: g.vis.x - 14, top: g.vis.y - 10, width: g.vis.w + 28, height: g.vis.h + 20, borderRadius: 32, background: hex.sand, opacity: 0.55 * panel }} />
        <Headline text={scene.onScreenText} g={g} />
        <div style={{ position: "absolute", left: g.vis.x, top: g.vis.y, width: g.vis.w, height: g.vis.h, scale: String(push) }}>
          <svg width={g.vis.w} height={g.vis.h} viewBox={`0 0 ${g.vis.w} ${g.vis.h}`} style={{ overflow: "visible" }}>
            {isCta ? <CtaCard label={video.cta.text} url={display} icon={ctaIcon} w={g.vis.w} h={g.vis.h} /> : renderSpec(spec, g.vis.w, g.vis.h)}
          </svg>
        </div>
      </AbsoluteFill>
    </SceneCtx.Provider>
  );
}

function Captions({ pages, g, disclaimerStartMs }: { pages: Page[]; g: Geo; disclaimerStartMs: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const idx = pages.findIndex((p) => ms >= p.startMs && ms < p.endMs);
  if (idx < 0 || ms >= disclaimerStartMs) return null;
  const page = pages[idx];
  const fit = fitTextOnNLines({ text: page.text, maxLines: 2, maxBoxWidth: (g.cap.w - 64) * 0.93, fontFamily: "Inter", fontWeight: 600, maxFontSize: g.cap.max });
  const p = interpolate(ms - page.startMs, [0, 160], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let cur = 0;
  page.tokens.forEach((t, i) => { if (ms >= t.fromMs) cur = i; });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: g.cap.y, height: g.cap.h, display: "flex", alignItems: g.vertical ? "center" : "flex-end", justifyContent: "center", opacity: p, translate: `0px ${(1 - p) * 8}px` }}>
      <div style={{ maxWidth: g.cap.w, padding: "14px 32px", borderRadius: 22, background: "rgba(255,255,255,0.96)", border: `2px solid ${hex.line}`, boxShadow: "0 6px 24px rgba(29,43,58,0.10)", fontFamily: FONT, fontWeight: 600, fontSize: fit.fontSize, lineHeight: 1.3, color: hex.ink, textAlign: "center" }}>
        {page.tokens.map((t, i) => (
          <span key={i}>
            {t.text.startsWith(" ") ? " " : ""}
            <span style={{ padding: "1px 2px", borderRadius: 8, background: i === cur ? hex.accentTint : "transparent", color: i === cur ? hex.accentDeep : hex.ink }}>{t.text.trim()}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export const Explainer: React.FC<ExplainerProps> = ({ videoId, aspect, audioSrc, hideCaptions }) => {
  const video = videos.find((v) => v.id === videoId)!;
  const g = geo(aspect);
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const pages = useMemo(() => buildPages(video, g.vertical ? VERTICAL_LIMITS : HORIZONTAL_LIMITS), [video, g.vertical]);
  const bounds = video.scenes.map((s) => frames(s.startSec));
  bounds.push(durationInFrames);
  const disc = video.scenes.find((s) => s.id === video.disclaimer.sceneId);
  const items: React.ReactNode[] = [];
  video.scenes.forEach((s, i) => {
    const len = bounds[i + 1] - bounds[i];
    const last = i === video.scenes.length - 1;
    if (i > 0) {
      const toCta = s.id === video.cta.cardSceneId;
      items.push(
        <TransitionSeries.Transition
          key={"t" + i}
          presentation={toCta ? slide({ direction: "from-bottom" }) : fade()}
          timing={linearTiming({ durationInFrames: TRANSITION })}
        />,
      );
    }
    items.push(
      <TransitionSeries.Sequence key={s.id} name={s.id} durationInFrames={len + (last ? 0 : TRANSITION)} premountFor={fps}>
        <SceneView video={video} scene={s} g={g} />
      </TransitionSeries.Sequence>,
    );
  });
  return (
    <AbsoluteFill style={{ background: hex.paper }}>
      <style>{"svg text { font-family: Inter, system-ui, sans-serif !important; }"}</style>
      <TransitionSeries>{items}</TransitionSeries>
      {!hideCaptions && <Captions pages={pages} g={g} disclaimerStartMs={(disc ? disc.startSec : 1e9) * 1000} />}
      {g.vertical && frame < (disc ? disc.startSec * fps : 1e9) && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 90, display: "flex", justifyContent: "center", opacity: 0.8 }}>
          <Wordmark size={24} color={hex.muted} />
        </div>
      )}
      {hideCaptions && !g.vertical && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, display: "flex", justifyContent: "center" }}>
          <Wordmark size={30} />
        </div>
      )}
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 6, width: `${(frame / durationInFrames) * 100}%`, background: hex.accent, opacity: 0.85 }} />
      {audioSrc ? <Audio src={audioSrc} premountFor={fps} /> : null}
    </AbsoluteFill>
  );
};
