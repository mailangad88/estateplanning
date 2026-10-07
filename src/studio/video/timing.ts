import type { Scene, VideoPlan } from "../../server/studio/types";

/** Frames a scene is on screen. Scenes cross-fade into the next one inside this length. */
export function sceneFrames(scene: Pick<Scene, "durationSec">, fps: number): number {
  return Math.max(1, Math.round(scene.durationSec * fps));
}

/** Start frame of every scene, in order. */
export function sceneStarts(plan: Pick<VideoPlan, "scenes" | "fps">): number[] {
  const out: number[] = [];
  let t = 0;
  for (const s of plan.scenes) {
    out.push(t);
    t += sceneFrames(s, plan.fps);
  }
  return out;
}

/** Total length of the video in frames: the sum of every scene's durationSec * fps. */
export function planDurationInFrames(plan: Pick<VideoPlan, "scenes" | "fps">): number {
  return Math.max(1, plan.scenes.reduce((n, s) => n + sceneFrames(s, plan.fps), 0));
}
