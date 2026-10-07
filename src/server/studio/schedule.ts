/**
 * Publishing schedule. Each series (YouTube long videos, YouTube Shorts, Instagram Reels) has an
 * on/off switch and a weekly recurrence in local time (America/Chicago by default). Approved
 * videos take the earliest open slot of each series they go to, oldest approval first. A short
 * gets one slot in YouTube Shorts and one in Instagram Reels: the same video, posted twice.
 */
import type { Actor } from "@/server/types";
import { assertStudio } from "./access";
import { DEFAULT_SERIES, DEFAULT_SETTINGS } from "./config";
import { isApproved } from "./pipeline";
import type { StudioStore } from "./store";
import type { PlannedPost, Platform, PublishMode, Recurrence, Series, SeriesId, StudioSettings, StudioVideo, VideoFormat } from "./types";

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

const noon = (date: string) => new Date(`${date}T12:00:00Z`);
function addDays(date: string, n: number): string {
  const d = noon(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = (date: string) => noon(date).getUTCDay();
/** Whole weeks between the Sundays starting each date's week. */
const weeksBetween = (a: string, b: string) => Math.round((noon(addDays(b, -weekday(b))).getTime() - noon(addDays(a, -weekday(a))).getTime()) / (7 * 86_400_000));

/** The instants a recurrence fires after `from`, looking `days` local days ahead. */
export function occurrences(rec: Recurrence, timeZone: string, from: Date, days: number): Date[] {
  const out: Date[] = [];
  const first = localDate(from, timeZone);
  for (let i = 0; i < days; i++) {
    const date = addDays(first, i);
    if (date < rec.start || !rec.days.includes(weekday(date))) continue;
    if (rec.end && date > rec.end) break;
    if (weeksBetween(rec.start, date) % rec.everyWeeks !== 0) continue;
    for (const t of rec.times) {
      const at = zonedToUtc(date, t, timeZone);
      if (at > from) out.push(at);
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

export interface Slot {
  at: Date;
  seriesId: SeriesId;
  format: VideoFormat;
  platform: Platform;
}

/** Every slot of the switched-on series from `from` for `days` local days, in time order. */
export function slots(settings: StudioSettings, from: Date, days: number): Slot[] {
  return settings.series
    .filter((s) => s.enabled)
    .flatMap((s) => occurrences(s.recurrence, settings.timezone, from, days).map((at) => ({ at, seriesId: s.id, format: s.format, platform: s.platform })))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/* ---------- plain-English descriptions ---------- */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

export function clock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const longDate = (date: string) => noon(date).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** "Occurs every day at 10:00 AM and 6:00 PM starting Thursday, October 8, 2026. Each video waits 12 h before it goes." */
export function describeRecurrence(rec: Recurrence): string {
  const days = [...rec.days].sort();
  const which =
    days.length === 7 ? "day" : days.join() === "1,2,3,4,5" ? "weekday" : days.join() === "0,6" ? "Saturday and Sunday" : list(days.map((d) => DAY_NAMES[d]));
  const every = rec.everyWeeks > 1 ? `every ${rec.everyWeeks} weeks on ${days.length === 7 ? "every day" : which}` : `every ${which}`;
  const end = rec.end ? ` until ${longDate(rec.end)}` : "";
  const hold = rec.holdHours ? ` Each video waits ${rec.holdHours} h before it goes.` : "";
  return `Occurs ${every} at ${list(rec.times.map(clock))} starting ${longDate(rec.start)}${end}.${hold}`;
}

/** Posts a day at this recurrence's pace (a fraction for less-than-daily series). */
export function perDay(rec: Recurrence): number {
  return Math.round(((rec.days.length * rec.times.length) / (7 * rec.everyWeeks)) * 10) / 10;
}

/* ---------- settings ---------- */

type StoredSettings = Partial<StudioSettings> & { longSlots?: string[]; shortSlots?: string[] };

/** Settings with every series present (older saves had longSlots/shortSlots instead of series). */
export function normalizeSettings(stored: StoredSettings | null | undefined): StudioSettings {
  if (!stored) return DEFAULT_SETTINGS;
  const series = DEFAULT_SERIES.map((d) => {
    const saved = stored.series?.find((s) => s.id === d.id);
    if (saved) return { ...d, ...saved, recurrence: { ...d.recurrence, ...saved.recurrence } };
    const legacy = d.format === "long" ? stored.longSlots : stored.shortSlots;
    return legacy?.length ? { ...d, recurrence: { ...d.recurrence, times: legacy } } : d;
  });
  const { longSlots: _l, shortSlots: _s, ...rest } = stored;
  return { ...DEFAULT_SETTINGS, ...rest, series };
}

export async function getSettings(store: StudioStore): Promise<StudioSettings> {
  return normalizeSettings(await store.getSettings());
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function cleanRecurrence(input: Partial<Recurrence>, current: Recurrence): Recurrence {
  const start = String(input.start ?? current.start);
  if (!DATE.test(start)) throw new Error("Pick a start date");
  const everyWeeks = Math.round(Number(input.everyWeeks ?? current.everyWeeks));
  if (!(everyWeeks >= 1 && everyWeeks <= 8)) throw new Error("Repeat every 1 to 8 weeks");
  const days = [...new Set((input.days ?? current.days).map(Number))].filter((d) => d >= 0 && d <= 6).sort();
  if (!days.length) throw new Error("Pick at least one day");
  const times = [...new Set((input.times ?? current.times).map((t) => String(t).trim()).filter(Boolean))].sort();
  for (const t of times) if (!TIME.test(t)) throw new Error(`"${t}" is not a time like 09:30`);
  if (!times.length) throw new Error("Add at least one time");
  if (times.length > 10) throw new Error("At most 10 times a day");
  const end = input.end === undefined ? current.end : input.end ? String(input.end) : undefined;
  if (end && (!DATE.test(end) || end < start)) throw new Error("The end date has to be after the start");
  const holdHours = Math.round(Number(input.holdHours ?? current.holdHours));
  if (!(holdHours >= 0 && holdHours <= 168)) throw new Error("Hold is 0 to 168 hours");
  return { start, everyWeeks, days, times, end, holdHours };
}

export async function saveSettings(store: StudioStore, actor: Actor, input: { bufferDays?: number }, now = new Date()): Promise<StudioSettings> {
  assertStudio(actor, "manage_channels");
  const current = await getSettings(store);
  return store.saveSettings({ ...current, bufferDays: Math.min(14, Math.max(1, input.bufferDays ?? current.bufferDays)), updatedAt: now.toISOString(), updatedBy: actor.userId });
}

/**
 * Switches a series on or off, or changes when it posts. Videos waiting in that series lose
 * their slot and are re-slotted on the new pattern (or wait, when it is switched off).
 */
export async function saveSeries(
  store: StudioStore,
  actor: Actor,
  id: string,
  patch: { enabled?: boolean; recurrence?: Partial<Recurrence> },
  now = new Date(),
): Promise<StudioSettings> {
  assertStudio(actor, "manage_channels");
  const settings = await getSettings(store);
  const series = settings.series.find((s) => s.id === id);
  if (!series) throw new Error("No such series");
  const next: Series = {
    ...series,
    enabled: patch.enabled ?? series.enabled,
    recurrence: patch.recurrence ? cleanRecurrence(patch.recurrence, series.recurrence) : series.recurrence,
  };
  const at = now.toISOString();
  const saved = await store.saveSettings({ ...settings, series: settings.series.map((s) => (s.id === id ? next : s)), updatedAt: at, updatedBy: actor.userId });
  const what = patch.enabled === false ? `${series.name} switched off` : patch.enabled === true && !series.enabled ? `${series.name} switched on` : `${series.name} times changed`;
  for (const v of await store.listVideos()) {
    if (!v.slots?.some((s) => s.seriesId === id && !postedOn(v, s.platform))) continue;
    await store.saveVideo(withSlots(v, v.slots.filter((s) => s.seriesId !== id || postedOn(v, s.platform)), at, { at, by: actor.userId, event: "slot_released", note: what }));
  }
  await fillSlots(store, now);
  return saved;
}

/* ---------- filling and releasing slots ---------- */

export const postedOn = (v: StudioVideo, platform: Platform) => v.posts.some((p) => p.platform === platform && p.status !== "failed");

/** Earliest slot still to go, for lists and sorting. */
export function nextSlot(v: StudioVideo): string | undefined {
  return v.slots?.filter((s) => !postedOn(v, s.platform)).map((s) => s.at).sort()[0];
}

/** Applies a new slot list and the stage that follows from it. */
export function withSlots(v: StudioVideo, slotList: PlannedPost[], at: string, entry?: StudioVideo["history"][number]): StudioVideo {
  const next = { ...v, slots: slotList.length ? slotList : undefined };
  const pending = slotList.some((s) => !postedOn(v, s.platform));
  const stage = v.stage === "approved" || v.stage === "scheduled" || v.stage === "published"
    ? pending ? "scheduled" : v.posts.some((p) => p.status !== "failed") ? "published" : "approved"
    : v.stage;
  return { ...next, stage, slotAt: nextSlot(next), updatedAt: at, history: entry ? [...v.history, entry] : v.history };
}

/** Puts approved videos into the open slots of each series they go to. Returns the videos it scheduled. */
export async function fillSlots(store: StudioStore, now = new Date(), days = 14): Promise<StudioVideo[]> {
  const settings = await getSettings(store);
  const videos = await store.listVideos();
  const taken = new Set(videos.flatMap((v) => v.slots ?? []).map((s) => `${s.seriesId}|${s.at}`));
  const waiting = videos
    .filter((v) => (v.stage === "approved" || v.stage === "scheduled" || v.stage === "published") && isApproved(v))
    .sort((a, b) => (a.review?.at ?? "").localeCompare(b.review?.at ?? ""));
  const changed = new Map<string, StudioVideo>();
  const at = now.toISOString();
  for (const series of settings.series.filter((s) => s.enabled)) {
    const holdUntil = new Date(now.getTime() + series.recurrence.holdHours * 3_600_000);
    const open = occurrences(series.recurrence, settings.timezone, holdUntil, days).filter((t) => !taken.has(`${series.id}|${t.toISOString()}`));
    for (const original of waiting) {
      const v = changed.get(original.id) ?? original;
      if (v.format !== series.format || !v.targets.includes(series.platform)) continue;
      if (postedOn(v, series.platform) || v.slots?.some((s) => s.platform === series.platform)) continue;
      const slot = open.shift();
      if (!slot) break;
      const planned: PlannedPost = { seriesId: series.id, platform: series.platform, at: slot.toISOString() };
      changed.set(v.id, withSlots(v, [...(v.slots ?? []), planned], at, { at, by: "system", event: "scheduled", note: `${series.name} ${slot.toISOString()}` }));
    }
  }
  const out: StudioVideo[] = [];
  for (const v of changed.values()) out.push(await store.saveVideo(v));
  return out;
}

/** Manual unschedule (marketing): every slot still to go is freed. */
export async function unschedule(store: StudioStore, actor: Actor, id: string, now = new Date()): Promise<StudioVideo> {
  assertStudio(actor, "make_videos");
  const v = await store.getVideo(id);
  if (!v || v.stage !== "scheduled") throw new Error("This video is not scheduled");
  const at = now.toISOString();
  return store.saveVideo(withSlots(v, (v.slots ?? []).filter((s) => postedOn(v, s.platform)), at, { at, by: actor.userId, event: "unscheduled" }));
}

/* ---------- status ---------- */

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
    // One short serves both short series, so the busier one sets the pace.
    const pace = Math.max(0, ...settings.series.filter((s) => s.enabled && s.format === format).map((s) => perDay(s.recurrence)));
    const mine = videos.filter((v) => v.format === format);
    const scheduled = mine.filter((v) => v.stage === "scheduled").length;
    const approvedWaiting = mine.filter((v) => v.stage === "approved").length;
    const inReview = mine.filter((v) => v.stage === "in_review").length;
    return { format, perDay: pace, scheduled, approvedWaiting, inReview, daysReady: pace ? Math.floor(((scheduled + approvedWaiting) / pace) * 10) / 10 : 0 };
  });
}

/** One line per series for the schedule page: what went out, what is lined up, what is missing. */
export function seriesNote(series: Series, settings: StudioSettings, videos: StudioVideo[], mode: PublishMode, now: Date): string {
  const mine = videos.filter((v) => v.format === series.format);
  const posts = mine.flatMap((v) => v.posts.filter((p) => p.platform === series.platform));
  const sent = posts.filter((p) => p.status !== "failed").length;
  const queued = mine.flatMap((v) => (v.slots ?? []).filter((s) => s.seriesId === series.id && !postedOn(v, s.platform))).length;
  const parts = [`${sent} ${mode === "off" ? "logged" : "posted"}, ${queued} scheduled`];
  if (!series.enabled) parts.push("switched off");
  else {
    const next24 = occurrences(series.recurrence, settings.timezone, now, 2).filter((t) => t.getTime() - now.getTime() <= 86_400_000).length;
    const covered = Math.min(queued, next24);
    if (next24 > covered) parts.push(`${next24 - covered} of the next 24 h's ${next24} slots are empty; approve more ${series.format === "long" ? "long videos" : "shorts"}`);
    if (series.platform === "instagram" && mode === "private") parts.push("Instagram has no private posts, so Reels wait until publishing is live");
  }
  const failed = posts.filter((p) => p.status === "failed").sort((a, b) => b.at.localeCompare(a.at))[0];
  if (failed) parts.push(`last failure: ${failed.error ?? "unknown error"}`);
  return parts.join("; ");
}
