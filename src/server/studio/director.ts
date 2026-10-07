/**
 * The director turns a script into a scene list for the Remotion templates (src/studio/video).
 * Deterministic on purpose: the same script always gives the same video, so an approval
 * covers exactly what will be rendered.
 */
import { DISCLAIMER, endCard, WORDS_PER_SECOND } from "./config";
import type { BeatRole, Scene, SceneTemplate, Script, ScriptBeat, Topic, VideoFormat, VideoPlan } from "./types";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((x) => x.trim()) ?? [s.trim()];

/** Longest narration one scene carries before the director cuts to a new one. */
const MAX_SCENE_WORDS: Record<VideoFormat, number> = { long: 38, short: 30 };

const TEMPLATE: Record<BeatRole, SceneTemplate> = {
  hook: "title",
  question: "question",
  answer: "statement",
  example: "example",
  steps: "points",
  myth: "myth",
  next_step: "points",
  cta: "cta",
};

const CLUSTER_ICON: Record<string, string> = {
  "after-a-death": "family-tree",
  trusts: "trust",
  probate: "courthouse",
  illinois: "map-pin",
  "elder-care": "hand-heart",
  "estate-tax": "dollar",
  "what-if": "question-mark",
  wills: "will",
  basics: "document",
  "property-and-assets": "house",
  "digital-assets": "lock",
  "special-needs": "shield",
  "power-of-attorney": "power-of-attorney",
  "beneficiary-designations": "family-tree",
  "life-stages": "sprout",
  "business-owners": "briefcase",
  "blended-families": "family",
  guardianship: "child",
  "healthcare-directives": "health-directive",
};

const ROLE_ICON: Partial<Record<BeatRole, string>> = { question: "question-mark", steps: "list", next_step: "check-circle", myth: "scale", cta: "phone" };

/** Seconds for a piece of narration, with a beat of breathing room. */
export function secondsFor(text: string, min = 2.5): number {
  return Math.max(min, Math.round((words(text) / WORDS_PER_SECOND + 0.8) * 10) / 10);
}

export function planSeconds(plan: VideoPlan): number {
  return plan.scenes.reduce((s, sc) => s + sc.durationSec, 0);
}

/** Splits narration into chunks of whole sentences under a word limit. */
export function chunkNarration(text: string, max: number): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let n = 0;
  for (const s of sentences(text)) {
    const w = words(s);
    if (cur.length && n + w > max) {
      out.push(cur.join(" "));
      cur = [];
      n = 0;
    }
    cur.push(s);
    n += w;
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}

/** The first sentence as a supporting line when it is short enough to read at a glance; never cut mid-sentence. */
function shorten(text: string, max = 20): string | undefined {
  const first = sentences(text)[0] ?? text;
  return words(first) <= max ? first : undefined;
}

function scenesForBeat(beat: ScriptBeat, format: VideoFormat, topic: Topic, chapter?: string): Scene[] {
  const template = TEMPLATE[beat.role];
  const icon = ROLE_ICON[beat.role] ?? CLUSTER_ICON[topic.cluster] ?? "document";
  const base = { beatId: beat.id, icon, fictional: beat.fictional || undefined, chapter };
  // Points, myths and the end card stay on one scene so the list can build up on screen.
  if (template === "points" || template === "myth" || template === "cta" || template === "question" || template === "title") {
    const pointsTime = (beat.points?.length ?? 0) * 1.2;
    return [{
      ...base,
      id: `${beat.id}-1`,
      template: template === "points" && !(beat.points?.length) ? "statement" : template,
      durationSec: Math.max(secondsFor(beat.narration), template === "cta" ? 6 : 3 + pointsTime),
      headline: beat.onScreen,
      body: template === "question" || template === "title" ? undefined : template === "cta" ? undefined : shorten(beat.narration),
      points: beat.points,
      caption: beat.narration,
    }];
  }
  const chunks = chunkNarration(beat.narration, MAX_SCENE_WORDS[format]);
  return chunks.map((chunk, i) => ({
    ...base,
    id: `${beat.id}-${i + 1}`,
    template: i === 0 ? template : "statement",
    durationSec: secondsFor(chunk),
    headline: beat.onScreen,
    body: shorten(chunk),
    caption: chunk,
  }));
}

export function direct(input: { format: VideoFormat; topic: Topic; script: Script; audioSrc?: string }): VideoPlan {
  const { format, topic, script } = input;
  const chapters = new Map(script.chapters?.map((c) => [c.beatId, c.title]) ?? []);
  let chapter: string | undefined;
  const scenes: Scene[] = [];
  for (const beat of script.beats) {
    if (format === "long" && chapters.has(beat.id)) chapter = chapters.get(beat.id);
    scenes.push(...scenesForBeat(beat, format, topic, format === "long" ? chapter : undefined));
  }
  const long = format === "long";
  return {
    format,
    width: long ? 1920 : 1080,
    height: long ? 1080 : 1920,
    fps: 30,
    title: script.title,
    scenes,
    disclaimer: topic.state === "IL" ? `${DISCLAIMER} Illinois law as of ${new Date().getFullYear()}.` : DISCLAIMER,
    endCard: endCard(),
    audioSrc: input.audioSrc,
  };
}
