/**
 * TipShort: a 9:16 short for Instagram Reels, Facebook Reels and YouTube Shorts, rendered by Remotion from
 * one entry of content/social/calendar.json. The same scene list also drives the Blender renderer
 * (blender/render_short.py); each video's `renderer` field picks which one is used.
 *
 * What Remotion adds over Blender: crisp text layout, count-up stats and bars, word-timed captions from the
 * voiceover, and fast renders. Blender keeps the 3D house scenes.
 *
 * Every frame carries the disclaimer line. The last scene is the /tips URL card.
 */
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fitTextOnNLines } from "@remotion/layout-utils";
import calendarRaw from "../../../content/social/calendar.json";
import { hex } from "../../../src/components/visuals/tokens";
import { FONT, ease } from "../visual/anim";
import { Glyph, Wordmark, card, fitParagraph, Paragraph } from "./ui";

export const W = 1080, H = 1920, FPS = 30;
const M = 80;

type Scene = {
  type: "hook" | "point" | "stat" | "steps" | "myth" | "broll" | "house" | "end";
  seconds: number;
  text?: string; kicker?: string | null; value?: string; label?: string; cite?: string | null;
  title?: string; items?: string[]; start?: number; sign?: boolean; myth?: string; fact?: string; url?: string; video?: string;
};
type Video = { id: string; title: string; voiceover: string[]; blender: { scenes: Scene[] } };
type Calendar = { defaults: { brand: string; disclaimer: string }; videos: Video[] };

const calendar = calendarRaw as unknown as Calendar;
export const tipVideos = calendar.videos;
export const getTipVideo = (id: string) => calendar.videos.find((v) => v.id === id) ?? calendar.videos[0];

export type TipShortProps = { id: string; captions?: boolean; audioSrc?: string };

/** Frame layout of a video: where each scene starts. The `house` scene is Blender-only and shows as a point card here. */
export function tipPlan(id: string) {
  const v = getTipVideo(id);
  let t = 0;
  const scenes = v.blender.scenes.map((s) => {
    const len = Math.max(1, Math.round(s.seconds * FPS));
    const out = { scene: s, from: t, len };
    t += len;
    return out;
  });
  return { video: v, scenes, total: t };
}

const useIn = (at: number, len = 0.6) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [at * FPS, (at + len) * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
};
const lift = (p: number, px = 28) => ({ opacity: p, translate: `0px ${(1 - p) * px}px` });

function Lines({ text, maxLines, boxW, maxSize, weight = 800, color = hex.ink, align = "center" }: { text: string; maxLines: number; boxW: number; maxSize: number; weight?: number; color?: string; align?: "left" | "center" }) {
  const f = fitTextOnNLines({ text, maxLines, maxBoxWidth: boxW, fontFamily: "Inter", fontWeight: weight, maxFontSize: maxSize });
  return (
    <div style={{ fontSize: f.fontSize, fontWeight: weight, color, lineHeight: 1.15, textAlign: align, letterSpacing: "-0.01em" }}>
      {f.lines.map((l, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>)}
    </div>
  );
}

function Kicker({ text, color = hex.clay }: { text?: string | null; color?: string }) {
  if (!text) return null;
  return <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color }}>{text}</div>;
}

/* ---------------- scenes ---------------- */

function Hook({ s }: { s: Scene }) {
  const a = useIn(0.05), b = useIn(0.25, 0.7);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${M}px` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 520, height: 820, background: hex.ink, ...lift(a, 0) }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
        <div style={lift(a)}><Kicker text={s.kicker} color={hex.gold} /></div>
        <div style={lift(b, 40)}><Lines text={s.text ?? ""} maxLines={4} boxW={W - 2 * M} maxSize={104} color={hex.paper} /></div>
      </div>
    </AbsoluteFill>
  );
}

function Point({ s, accent = hex.accent }: { s: Scene; accent?: string }) {
  const a = useIn(0.05), b = useIn(0.25, 0.7);
  const inner = W - 2 * M - 140;
  const fit = fitParagraph(s.text ?? "", inner, 640, 76, 40, 800, 1.2);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${M}px` }}>
      <div style={{ ...card, borderRadius: 52, padding: "64px 70px", borderLeft: `14px solid ${accent}`, ...lift(a) }}>
        <Kicker text={s.kicker} />
        <div style={{ height: s.kicker ? 34 : 0 }} />
        <div style={lift(b, 18)}><Paragraph fit={fit} weight={800} /></div>
      </div>
    </AbsoluteFill>
  );
}

/** Counts up numbers in a stat ("$150K", "6 months", "$20,000+"); non-numeric values pop in. */
function countUp(value: string, p: number) {
  const m = value.match(/^(\D*)([\d,.]+)(.*)$/);
  if (!m) return value;
  const n = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n)) return value;
  const cur = Math.round(n * p);
  const withCommas = m[2].includes(",") ? cur.toLocaleString("en-US") : String(cur);
  return `${m[1]}${withCommas}${m[3]}`;
}

function Stat({ s }: { s: Scene }) {
  const ring = useIn(0.05, 1.0), num = useIn(0.15, 1.2), lab = useIn(0.6), cite = useIn(1.0);
  const R = 300, C = 2 * Math.PI * (R - 18);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 70, padding: `0 ${M}px` }}>
      <div style={{ position: "relative", width: R * 2, height: R * 2 }}>
        <svg width={R * 2} height={R * 2} style={{ position: "absolute", inset: 0 }}>
          <circle cx={R} cy={R} r={R - 18} fill={hex.accentTint} />
          <circle cx={R} cy={R} r={R - 18} fill="none" stroke={hex.accent} strokeWidth={28} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - ring)} transform={`rotate(-90 ${R} ${R})`} />
        </svg>
        <div style={{ position: "absolute", inset: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lines text={countUp(s.value ?? "", num)} maxLines={1} boxW={R * 2 - 140} maxSize={150} color={hex.accentDeep} />
        </div>
      </div>
      <div style={lift(lab)}><Lines text={s.label ?? ""} maxLines={3} boxW={W - 2 * M} maxSize={60} weight={700} /></div>
      {s.cite ? <div style={{ ...lift(cite, 10), fontSize: 30, color: hex.muted, fontWeight: 600 }}>{s.cite}</div> : null}
    </AbsoluteFill>
  );
}

function Steps({ s }: { s: Scene }) {
  const items = (s.items ?? []).slice(0, 4);
  const head = useIn(0.05);
  const gap = Math.min(1.1, Math.max(0.45, (s.seconds - 1.5) / (items.length + 1)));
  const appear = items.map((_, i) => 0.4 + i * gap);
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${M}px`, gap: 44 }}>
      {s.title ? <div style={lift(head)}><Lines text={s.title} maxLines={2} boxW={W - 2 * M} maxSize={84} align="left" /></div> : null}
      {items.map((it, i) => {
        const p = interpolate(frame, [appear[i] * FPS, (appear[i] + 0.5) * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
        const fit = fitParagraph(it, W - 2 * M - 200, 200, 54, 32, 700, 1.2);
        return (
          <div key={it} style={{ ...card, borderRadius: 36, padding: "34px 40px", display: "flex", alignItems: "center", gap: 36, ...lift(p, 40) }}>
            <div style={{ flex: "0 0 auto", width: 92, height: 92, borderRadius: 46, background: hex.clay, color: hex.surface, fontSize: 50, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + (s.start ?? 1)}</div>
            <Paragraph fit={fit} weight={700} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function Myth({ s }: { s: Scene }) {
  const a = useIn(0.05), strike = useIn(0.9, 0.5), b = useIn(1.4, 0.7);
  const mFit = fitParagraph(s.myth ?? "", W - 2 * M - 120, 300, 66, 36, 800, 1.2);
  const fFit = fitParagraph(s.fact ?? "", W - 2 * M - 120, 520, 58, 34, 700, 1.25);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${M}px`, gap: 48 }}>
      <div style={{ ...card, background: hex.sand, borderRadius: 44, padding: "48px 60px", position: "relative", ...lift(a) }}>
        <Kicker text="Myth" />
        <div style={{ height: 24 }} />
        <div style={{ position: "relative", opacity: 1 - 0.45 * strike }}>
          <Paragraph fit={mFit} weight={800} />
          <div style={{ position: "absolute", left: 0, top: "50%", height: 10, borderRadius: 5, width: `${strike * 100}%`, background: hex.clay }} />
        </div>
      </div>
      <div style={{ borderRadius: 44, padding: "48px 60px", background: hex.accent, ...lift(b, 40) }}>
        <Kicker text="Fact" color={hex.gold} />
        <div style={{ height: 24 }} />
        <Paragraph fit={fFit} weight={700} color={hex.paper} />
      </div>
    </AbsoluteFill>
  );
}

function Broll({ s }: { s: Scene }) {
  const cap = useIn(0.3);
  return (
    <AbsoluteFill>
      {s.video ? <OffthreadVideo src={staticFile(s.video)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <AbsoluteFill style={{ background: hex.ink }} />}
      <div style={{ position: "absolute", top: 210, right: M, fontSize: 26, fontWeight: 700, color: hex.paper, background: "rgba(0,0,0,0.45)", padding: "8px 18px", borderRadius: 20 }}>AI-generated footage</div>
      {s.text ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 420, padding: `40px ${M}px`, background: "rgba(27,42,48,0.82)", ...lift(cap) }}>
          <Lines text={s.text} maxLines={3} boxW={W - 2 * M} maxSize={70} color={hex.paper} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

function End({ s }: { s: Scene }) {
  const a = useIn(0.05), b = useIn(0.3), c = useIn(0.6);
  const frame = useCurrentFrame();
  const pulse = interpolate(frame, [FPS * 1.2, FPS * 1.6, FPS * 2.0], [1, 1.04, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: hex.accent, alignItems: "center", justifyContent: "center", gap: 60, padding: `0 ${M}px` }}>
      <div style={lift(a)}><Lines text={s.text ?? "Get the full answer and a free checklist"} maxLines={2} boxW={W - 2 * M} maxSize={76} color={hex.paper} /></div>
      <div style={{ ...lift(b), scale: String(pulse), background: hex.paper, borderRadius: 70, padding: "36px 48px", display: "flex", alignItems: "center", gap: 20, maxWidth: W - 2 * M }}>
        <div>
          <Lines text={(s.url ?? "").split("/")[0]} maxLines={1} boxW={W - 2 * M - 180} maxSize={50} weight={800} color={hex.accentDeep} />
          <Lines text={"/" + (s.url ?? "").split("/").slice(1).join("/")} maxLines={1} boxW={W - 2 * M - 180} maxSize={40} weight={700} color={hex.accent} />
        </div>
        <Glyph name="arrow-right" size={52} color="accent" tint="none" strokeWidth={2.6} />
      </div>
      <div style={{ ...lift(c), textAlign: "center", color: hex.accentTint, fontSize: 36, fontWeight: 600, lineHeight: 1.35 }}>
        Link in bio. Illinois families only for now.
        <br />
        We match you with an appropriate Illinois estate planning attorney.
      </div>
    </AbsoluteFill>
  );
}

function SceneView({ s }: { s: Scene }) {
  switch (s.type) {
    case "hook": return <Hook s={s} />;
    case "point": return <Point s={s} />;
    case "house": return <Point s={{ ...s, kicker: s.kicker ?? "Your house" }} accent={hex.clay} />;
    case "stat": return <Stat s={s} />;
    case "steps": return <Steps s={s} />;
    case "myth": return <Myth s={s} />;
    case "broll": return <Broll s={s} />;
    case "end": return <End s={s} />;
  }
}

/* ---------------- captions ---------------- */

/** Spreads the voiceover lines over the video by word count, so the caption follows the spoken script. */
export function captionTimes(lines: string[], totalFrames: number) {
  const words = lines.map((l) => l.split(/\s+/).filter(Boolean).length);
  const sum = words.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  return lines.map((line, i) => {
    const len = Math.round((words[i] / sum) * totalFrames);
    const out = { line, from: t, len };
    t += len;
    return out;
  });
}

function Captions({ lines, total, onDark }: { lines: string[]; total: number; onDark: (f: number) => boolean }) {
  const frame = useCurrentFrame();
  const cur = captionTimes(lines, total).find((c) => frame >= c.from && frame < c.from + c.len);
  if (!cur) return null;
  const fit = fitParagraph(cur.line, W - 2 * M - 60, 210, 40, 26, 700, 1.3);
  const dark = onDark(frame);
  return (
    <div style={{ position: "absolute", left: M, right: M, bottom: 170, display: "flex", justifyContent: "center" }}>
      <div style={{ background: dark ? "rgba(255,255,255,0.14)" : "rgba(27,42,48,0.86)", borderRadius: 26, padding: "18px 30px" }}>
        <Paragraph fit={fit} weight={700} color={hex.paper} align="center" />
      </div>
    </div>
  );
}

/* ---------------- composition ---------------- */

export const TipShort: React.FC<TipShortProps> = ({ id, captions = true, audioSrc }) => {
  const plan = tipPlan(id);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const at = plan.scenes.find((x) => frame >= x.from && frame < x.from + x.len)?.scene.type;
  const darkAt = (f: number) => {
    const t = plan.scenes.find((x) => f >= x.from && f < x.from + x.len)?.scene.type;
    return t === "end" || t === "broll";
  };
  const onDark = at === "end" || at === "broll";
  const endStart = plan.scenes.find((x) => x.scene.type === "end")?.from ?? plan.total;
  return (
    <AbsoluteFill style={{ background: hex.paper, fontFamily: FONT }}>
      {plan.scenes.map(({ scene, from, len }, i) => (
        <Sequence key={i} from={from} durationInFrames={len} premountFor={FPS}>
          <SceneView s={scene} />
        </Sequence>
      ))}
      {!onDark ? <div style={{ position: "absolute", top: 110, left: 0, right: 0, display: "flex", justifyContent: "center" }}><Wordmark size={34} /></div> : null}
      {captions ? <Captions lines={plan.video.voiceover} total={endStart} onDark={darkAt} /> : null}
      <div style={{ position: "absolute", left: M, right: M, bottom: 70, textAlign: "center", fontSize: 26, fontWeight: 600, color: onDark ? hex.accentTint : hex.muted }}>
        {calendar.defaults.disclaimer}
      </div>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 14, width: `${(frame / durationInFrames) * 100}%`, background: hex.gold }} />
      {audioSrc ? <Audio src={audioSrc.startsWith("http") ? audioSrc : staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  );
};
