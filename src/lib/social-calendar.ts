/** Types and loader for the social video calendar in content/social/calendar.json. */
import fs from "node:fs";
import path from "node:path";

export type Pillar = "fear" | "tip" | "money" | "faq" | "myth" | "checklist";

export interface BlenderScene {
  type: "hook" | "point" | "stat" | "steps" | "myth" | "broll" | "end";
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
