/**
 * The production steps a video goes through, as shown on its page: done, next to run, waiting,
 * flagged (needs a person) or skipped.
 */
import { isApproved } from "./pipeline";
import { postedOn } from "./schedule";
import type { PublishMode, StudioVideo } from "./types";

export type StepState = "done" | "next" | "waiting" | "flagged" | "skipped";

export interface Step {
  id: string;
  label: string;
  state: StepState;
  note?: string;
}

export function productionSteps(v: StudioVideo, mode: PublishMode): Step[] {
  const blocking = v.quality?.checks.filter((c) => !c.ok && c.level === "block").length ?? 0;
  const warnings = v.quality?.checks.filter((c) => !c.ok && c.level === "warn").length ?? 0;
  const sentBack = v.review && v.review.decision !== "approved" && (v.stage === "changes_requested" || v.stage === "rejected");
  const allPosted = v.targets.length > 0 && v.targets.every((p) => postedOn(v, p));
  const failedPost = v.posts.some((p) => p.status === "failed") && !allPosted;
  // undefined = not reached yet; the first one becomes "next to run".
  const raw: [string, string, StepState | undefined, string?][] = [
    ["research", "Researched", v.research ? "done" : undefined, v.research ? `${v.research.sources.length} source${v.research.sources.length === 1 ? "" : "s"}` : undefined],
    ["script", "Script written", v.script ? "done" : undefined],
    ["checks", "Checks passed", !v.quality ? undefined : v.quality.passed ? "done" : "flagged", blocking ? `${blocking} failed` : warnings ? `${warnings} to look at` : undefined],
    ["voice", "Voice", v.plan?.audioSrc ? "done" : v.plan ? "skipped" : undefined, v.plan && !v.plan.audioSrc ? "captions only" : undefined],
    ["review", "Attorney approved", isApproved(v) ? "done" : sentBack ? "flagged" : undefined, sentBack ? (v.stage === "rejected" ? "rejected" : "sent back") : undefined],
    ["render", "Rendered", v.render.status === "done" ? "done" : v.render.status === "failed" ? "flagged" : undefined, v.render.status === "queued" || v.render.status === "rendering" ? v.render.status : v.render.status === "failed" ? "failed" : undefined],
    ["schedule", "Scheduled", v.slots?.length || allPosted ? "done" : undefined],
    ["post", mode === "off" ? "Posted (logged)" : "Posted", allPosted ? "done" : failedPost ? "flagged" : undefined, allPosted && mode === "off" ? "publishing is off" : undefined],
  ];
  let nextGiven = v.stage === "rejected";
  return raw.map(([id, label, state, note]) => {
    if (state === "flagged") nextGiven = true; // a person has to act before later steps run
    if (state) return { id, label, state, note };
    if (nextGiven) return { id, label, state: "waiting" as const, note };
    nextGiven = true;
    return { id, label, state: "next" as const, note };
  });
}
