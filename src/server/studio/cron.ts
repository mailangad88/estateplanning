/**
 * The studio's scheduled run: keep the review queue topped up (opt-in), fill publish slots
 * with approved videos, then post what is due.
 */
import { publishMode } from "./config";
import { generateDrafts } from "./pipeline";
import { publishDue, type PublishDeps } from "./publish";
import { bufferStatus, fillSlots, getSettings, seriesNote } from "./schedule";
import type { StudioStore } from "./store";
import type { Writer } from "./writer";

/** Drafts needed so review plus ready content covers bufferDays, capped per run to pace spend. */
export async function topUp(store: StudioStore, opts: { writer?: Writer; maxPerRun?: number; now?: Date } = {}): Promise<Record<string, number>> {
  const settings = await getSettings(store);
  const videos = await store.listVideos();
  const out: Record<string, number> = {};
  for (const b of bufferStatus(settings, videos)) {
    const want = b.perDay * settings.bufferDays;
    const have = b.scheduled + b.approvedWaiting + b.inReview;
    const n = Math.min(opts.maxPerRun ?? 3, Math.max(0, want - have));
    out[b.format] = n ? (await generateDrafts(store, null, { format: b.format, count: n, writer: opts.writer, now: opts.now })).length : 0;
  }
  return out;
}

export async function runStudioCron(store: StudioStore, opts: { autoDraft?: boolean; writer?: Writer; publish?: PublishDeps; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const drafted = opts.autoDraft ?? process.env.STUDIO_AUTO_DRAFT === "true" ? await topUp(store, { writer: opts.writer, now }) : { off: 0 };
  const scheduled = (await fillSlots(store, now)).map((v) => ({ id: v.id, slotAt: v.slotAt }));
  const published = await publishDue(store, { ...opts.publish, now });
  // A status line per series for the schedule page.
  const settings = await getSettings(store);
  const videos = await store.listVideos();
  const mode = opts.publish?.mode ?? publishMode();
  const at = now.toISOString();
  await store.saveSettings({ ...settings, series: settings.series.map((s) => ({ ...s, lastRun: { at, note: seriesNote(s, settings, videos, mode, now) } })) });
  return { drafted, scheduled, published };
}
