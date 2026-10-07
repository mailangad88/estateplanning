/**
 * Publishing slots. Settings hold local times (America/Chicago by default); approved videos
 * fill the earliest open slot of their format, oldest approval first.
 */
import type { Actor } from "@/server/types";
import { assertStudio } from "./access";
import { DEFAULT_SETTINGS } from "./config";
import { isApproved } from "./pipeline";
import type { StudioStore } from "./store";
import type { StudioSettings, StudioVideo, VideoFormat } from "./types";

/** Minutes the zone is ahead of UTC at a given instant (negative for the Americas). */
function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** The UTC instant for a local date (YYYY-MM-DD) and time (HH:MM) in a zone. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const first = new Date(guess.getTime() - zoneOffsetMinutes(timeZone, guess) * 60000);
  // Second pass settles days when the clocks change.
  return new Date(guess.getTime() - zoneOffsetMinutes(timeZone, first) * 60000);
}

function localDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export interface Slot {
  at: Date;
  format: VideoFormat;
}

/** Every slot from `from` for `days` local days, in time order. */
export function slots(settings: StudioSettings, from: Date, days: number): Slot[] {
  const out: Slot[] = [];
  const start = localDate(from, settings.timezone);
  for (let i = 0; i < days; i++) {
    const day = new Date(`${start}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + i);
    const date = day.toISOString().slice(0, 10);
    for (const t of settings.longSlots) out.push({ at: zonedToUtc(date, t, settings.timezone), format: "long" });
    for (const t of settings.shortSlots) out.push({ at: zonedToUtc(date, t, settings.timezone), format: "short" });
  }
  return out.filter((s) => s.at > from).sort((a, b) => a.at.getTime() - b.at.getTime());
}

export async function getSettings(store: StudioStore): Promise<StudioSettings> {
  return (await store.getSettings()) ?? DEFAULT_SETTINGS;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveSettings(store: StudioStore, actor: Actor, input: { longSlots: string[]; shortSlots: string[]; bufferDays?: number }, now = new Date()): Promise<StudioSettings> {
  assertStudio(actor, "manage_channels");
  const clean = (list: string[]) => [...new Set(list.map((t) => t.trim()).filter(Boolean))].sort();
  const longSlots = clean(input.longSlots);
  const shortSlots = clean(input.shortSlots);
  for (const t of [...longSlots, ...shortSlots]) if (!TIME.test(t)) throw new Error(`"${t}" is not a time like 09:30`);
  if (longSlots.length > 4 || shortSlots.length > 10) throw new Error("At most 4 long and 10 short slots a day");
  const current = await getSettings(store);
  return store.saveSettings({ ...current, longSlots, shortSlots, bufferDays: Math.min(14, Math.max(1, input.bufferDays ?? current.bufferDays)), updatedAt: now.toISOString(), updatedBy: actor.userId });
}

/** Puts approved, unscheduled videos into open slots. Returns the videos it scheduled. */
export async function fillSlots(store: StudioStore, now = new Date(), days = 14): Promise<StudioVideo[]> {
  const settings = await getSettings(store);
  const videos = await store.listVideos();
  const taken = new Set(videos.filter((v) => v.slotAt && (v.stage === "scheduled" || v.stage === "published")).map((v) => v.slotAt));
  const waiting = videos
    .filter((v) => v.stage === "approved" && isApproved(v) && !v.slotAt)
    .sort((a, b) => (a.review?.at ?? "").localeCompare(b.review?.at ?? ""));
  const open = slots(settings, now, days).filter((s) => !taken.has(s.at.toISOString()));
  const out: StudioVideo[] = [];
  for (const v of waiting) {
    const i = open.findIndex((s) => s.format === v.format);
    if (i < 0) continue;
    const [slot] = open.splice(i, 1);
    const at = now.toISOString();
    out.push(await store.saveVideo({ ...v, stage: "scheduled", slotAt: slot.at.toISOString(), updatedAt: at, history: [...v.history, { at, by: "system", event: "scheduled", note: slot.at.toISOString() }] }));
  }
  return out;
}

/** Manual unschedule (marketing): back to approved, slot freed. */
export async function unschedule(store: StudioStore, actor: Actor, id: string, now = new Date()): Promise<StudioVideo> {
  assertStudio(actor, "make_videos");
  const v = await store.getVideo(id);
  if (!v || v.stage !== "scheduled") throw new Error("This video is not scheduled");
  const at = now.toISOString();
  return store.saveVideo({ ...v, stage: "approved", slotAt: undefined, updatedAt: at, history: [...v.history, { at, by: actor.userId, event: "unscheduled" }] });
}

export interface BufferStatus {
  format: VideoFormat;
  perDay: number;
  scheduled: number;
  approvedWaiting: number;
  inReview: number;
  /** Days of content ready (scheduled plus approved) at the current pace. */
  daysReady: number;
}

export function bufferStatus(settings: StudioSettings, videos: StudioVideo[]): BufferStatus[] {
  return (["long", "short"] as VideoFormat[]).map((format) => {
    const perDay = (format === "long" ? settings.longSlots : settings.shortSlots).length;
    const mine = videos.filter((v) => v.format === format);
    const scheduled = mine.filter((v) => v.stage === "scheduled").length;
    const approvedWaiting = mine.filter((v) => v.stage === "approved").length;
    const inReview = mine.filter((v) => v.stage === "in_review").length;
    return { format, perDay, scheduled, approvedWaiting, inReview, daysReady: perDay ? Math.floor(((scheduled + approvedWaiting) / perDay) * 10) / 10 : 0 };
  });
}
