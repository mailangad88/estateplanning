/** Types and loader for the social video calendar in content/social/calendar.json. */
import fs from "node:fs";
import path from "node:path";

export type Pillar = "fear" | "tip" | "money" | "faq" | "myth" | "checklist";

export interface BlenderScene {
  type: "hook" | "point" | "stat" | "steps" | "myth" | "broll" | "house" | "end";
  /** broll only: path to a video file (for example a Seedance shot). */
  video?: string;
  seconds: number;
  text?: string;
  kicker?: string;
  value?: string;
  label?: string;
  cite?: string | null;
  title?: string;
  items?: string[];
  myth?: string;
  fact?: string;
  url?: string;
  /** steps only: number of the first item (to continue a list across scenes). */
  start?: number;
  /** house only (Blender): show a yard sign. */
  sign?: boolean;
}

export interface CalendarVideo {
  id: string;
  day: number;
  pillar: Pillar;
  /** Slug of the /tips page this video sends people to. */
  tip: string;
  title: string;
  hook: string;
  voiceover: string[];
  /** Which renderer makes this video: Remotion (default) or Blender (3D house scenes). */
  renderer: "remotion" | "blender";
  /** Scene list shared by both renderers (the key name predates Remotion support). */
  blender: { scenes: BlenderScene[] };
  caption: string;
  hashtags: string[];
  /** Optional AI b-roll shot for Seedance 2.0. Objects and places only. */
  seedance: { seconds: number; prompt: string } | null;
  sensitive: boolean;
  review: { status: "pending" | "approved" | "changes"; reviewer: string; notes: string };
}

export interface SocialCalendar {
  name: string;
  updated: string;
  status: string;
  cadence: string;
  rules: string[];
  defaults: { fps: number; brand: string; disclaimer: string };
  pillars: Record<Pillar, string>;
  renderers: Record<"remotion" | "blender", string>;
  videos: CalendarVideo[];
}

export function loadCalendar(file = path.join(process.cwd(), "content", "social", "calendar.json")): SocialCalendar {
  return JSON.parse(fs.readFileSync(file, "utf8")) as SocialCalendar;
}

/** Spoken length estimate at about 2.6 words per second, a calm pace for this audience. */
export function spokenSeconds(v: CalendarVideo): number {
  const words = v.voiceover.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.round(words / 2.6);
}

export function sceneSeconds(v: CalendarVideo): number {
  return v.blender.scenes.reduce((s, x) => s + x.seconds, 0);
}
