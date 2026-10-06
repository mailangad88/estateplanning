import type { Explainer } from "./data";

export const FPS = 30;
export const INTRO_FRAMES = 90;
export const STEP_FRAMES = 105;
export const OUTRO_FRAMES = 120;

export function durationFor(e: Explainer) {
  return INTRO_FRAMES + e.steps.length * STEP_FRAMES + OUTRO_FRAMES;
}
