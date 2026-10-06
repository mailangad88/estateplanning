import { createContext, useContext } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fitTextOnNLines, measureText } from "@remotion/layout-utils";

export const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const SceneCtx = createContext<{ dur: number; vertical: boolean }>({ dur: 6, vertical: false });

/** Local-scene timing helpers. rv(at, len) = eased 0..1 progress, in seconds. */
export function useScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { dur, vertical } = useContext(SceneCtx);
  const rv = (at: number, len = 0.8) =>
    interpolate(frame, [at * fps, (at + len) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return { frame, fps, sec: frame / fps, dur, vertical, rv };
}

/** Evenly spread n reveal times through the scene, leaving a calm hold at the end. */
export function stepTimes(n: number, dur: number, first = 0.6) {
  const span = Math.max(0.5, Math.min(dur - 2.4, n * 1.7));
  return (i: number) => first + (n <= 1 ? 0 : (i * span) / n);
}

export function wrapLabel(text: string, width: number, maxSize: number, maxLines = 2, weight = 600) {
  const r = fitTextOnNLines({ text, maxLines, maxBoxWidth: Math.max(40, width), fontFamily: "Inter", fontWeight: weight, maxFontSize: maxSize });
  return { size: Math.max(11, Math.min(maxSize, r.fontSize)), lines: r.lines };
}

export const textWidth = (text: string, size: number, weight = 600) =>
  measureText({ text, fontFamily: "Inter", fontSize: size, fontWeight: weight }).width;
