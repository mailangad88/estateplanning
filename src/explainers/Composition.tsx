"use client";

import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Explainer } from "./data";

import { INTRO_FRAMES, OUTRO_FRAMES, STEP_FRAMES } from "./timing";

const INK = "#1d1f22";
const MUTED = "#555b63";
const ACCENT = "#1f5f8b";
const BG = "#fbfaf7";

function Title({ text, sub }: { text: string; sub: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: BG, justifyContent: "center", padding: 80 }}>
      <div style={{ transform: `translateY(${(1 - s) * 40}px)`, opacity: s }}>
        <div style={{ fontSize: 64, fontWeight: 700, color: INK, lineHeight: 1.15 }}>{text}</div>
        <div style={{ fontSize: 34, color: MUTED, marginTop: 24, lineHeight: 1.35 }}>{sub}</div>
      </div>
    </AbsoluteFill>
  );
}

function Step({ index, total, title, body }: { index: number; total: number; title: string; body: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const bodyIn = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progress = interpolate(frame, [0, STEP_FRAMES], [index / total, (index + 1) / total], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: BG, padding: 80, justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start", opacity: enter, transform: `translateX(${(1 - enter) * 60}px)` }}>
        <div style={{ width: 120, height: 120, borderRadius: 60, background: ACCENT, color: "#fff", fontSize: 56, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {index + 1}
        </div>
        <div>
          <div style={{ fontSize: 56, fontWeight: 700, color: INK, lineHeight: 1.15 }}>{title}</div>
          <div style={{ fontSize: 34, color: MUTED, marginTop: 20, lineHeight: 1.4, opacity: bodyIn }}>{body}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 60, height: 10, background: "#d9d6cf", borderRadius: 5 }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: ACCENT, borderRadius: 5 }} />
      </div>
      <div style={{ position: "absolute", right: 80, bottom: 84, fontSize: 24, color: MUTED }}>{index + 1} of {total}</div>
    </AbsoluteFill>
  );
}

export function ExplainerVideo({ explainer }: { explainer: Explainer }) {
  const n = explainer.steps.length;
  return (
    <AbsoluteFill style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <Sequence durationInFrames={INTRO_FRAMES}>
        <Title text={explainer.title} sub={explainer.intro} />
      </Sequence>
      {explainer.steps.map((s, i) => (
        <Sequence key={s.title} from={INTRO_FRAMES + i * STEP_FRAMES} durationInFrames={STEP_FRAMES}>
          <Step index={i} total={n} title={s.title} body={s.body} />
        </Sequence>
      ))}
      <Sequence from={INTRO_FRAMES + n * STEP_FRAMES} durationInFrames={OUTRO_FRAMES}>
        <Title text="The takeaway" sub={explainer.outro} />
      </Sequence>
    </AbsoluteFill>
  );
}
