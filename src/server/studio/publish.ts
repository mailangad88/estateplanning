/**
 * Posts due videos. With STUDIO_PUBLISH_MODE=off (the default) nothing leaves the site: each
 * due video gets a "logged" post record showing exactly what would have gone out.
 */
import { DISCLAIMER, endCard, publishMode, trackedUrl } from "./config";
import { freshTokens, publishToInstagram, uploadToYouTube } from "./channels";
import type { Actor } from "@/server/types";
import { assertStudio } from "./access";
import { contentHash, isApproved, mustGet } from "./pipeline";
import { fillSlots, getSettings, postedOn, withSlots } from "./schedule";
import type { StudioStore } from "./store";
import type { Platform, PostRecord, PublishMode, StudioVideo } from "./types";

export function caption(v: StudioVideo, platform: Platform): string {
  if (!v.script) return "";
  const card = endCard();
  const link = trackedUrl(v.script.cta.path, platform, v.format, v.id);
  const tags = v.script.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  const chapters =
    platform === "youtube" && v.format === "long" && v.plan
      ? (() => {
          let t = 0;
          const lines: string[] = [];
          let last: string | undefined;
          for (const s of v.plan.scenes) {
            if (s.chapter && s.chapter !== last) {
              lines.push(`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")} ${s.chapter}`);
              last = s.chapter;
            }
            t += s.durationSec;
          }
          return lines.length >= 3 ? `\n\nChapters:\n${lines[0].startsWith("0:00") ? "" : "0:00 Intro\n"}${lines.join("\n")}` : "";
        })()
      : "";
  return [
    v.script.description,
    `${v.script.cta.label}: ${link}`,
    chapters.trim(),
    `${DISCLAIMER} ${card.advertisingLabel} ${card.firmName}, ${card.officeAddress}.`,
    tags,
  ].filter(Boolean).join("\n\n");
}

export function youtubeTitle(v: StudioVideo): string {
  const t = v.script?.title ?? v.topic.question;
  return v.format === "short" && !/#shorts/i.test(t) ? `${t} #Shorts` : t;
}

export interface PublishDeps {
  mode?: PublishMode;
  fetch?: typeof fetch;
  now?: Date;
}

export interface PublishResult {
  id: string;
  posts: PostRecord[];
  skipped?: string;
}

/** Publishes every slot whose time has passed, on switched-on series only. */
export async function publishDue(store: StudioStore, deps: PublishDeps = {}): Promise<PublishResult[]> {
  const mode = deps.mode ?? publishMode();
  const now = deps.now ?? new Date();
  const f = deps.fetch ?? fetch;
  const settings = await getSettings(store);
  const on = new Set(settings.series.filter((s) => s.enabled).map((s) => s.id));
  const dueSlots = (v: StudioVideo) => (v.slots ?? []).filter((s) => on.has(s.seriesId) && new Date(s.at) <= now && !postedOn(v, s.platform));
  const due = (await store.listVideos()).filter((v) => v.stage === "scheduled" && dueSlots(v).length);
  const out: PublishResult[] = [];
  for (const v of due) {
    const at = now.toISOString();
    if (!isApproved(v)) {
      // The script changed after approval (or the approval was not an attorney's): back to review.
      await store.saveVideo({ ...v, stage: "in_review", slotAt: undefined, slots: undefined, review: undefined, updatedAt: at, history: [...v.history, { at, by: "system", event: "unscheduled", note: "Approval no longer matches the script" }] });
      out.push({ id: v.id, posts: [], skipped: "approval no longer matches" });
      continue;
    }
    if (mode !== "off" && (v.render.status !== "done" || !v.render.videoUrl)) {
      out.push({ id: v.id, posts: [], skipped: "not rendered yet" });
      continue;
    }
    const posts: PostRecord[] = [];
    for (const slot of dueSlots(v)) posts.push(await postOne(store, v, slot.platform, mode, f, now));
    out.push({ id: v.id, posts });
    await store.saveVideo(recordPosts(v, posts, at, "system", mode));
  }
  return out;
}

function recordPosts(v: StudioVideo, posts: PostRecord[], at: string, by: string, mode: PublishMode): StudioVideo {
  const next = withSlots({ ...v, posts: [...v.posts, ...posts] }, v.slots ?? [], at);
  return { ...next, history: [...v.history, ...posts.map((p) => ({ at, by, event: `${p.platform}_${p.status}`, note: p.error ?? p.url ?? (p.status === "logged" ? `Publishing is ${mode}` : undefined) }))] };
}

/** Where a format can go: long videos are YouTube only; shorts go to YouTube Shorts and Instagram Reels. */
export const PLACES: Record<StudioVideo["format"], Platform[]> = { long: ["youtube"], short: ["youtube", "instagram"] };

function pickPlaces(v: StudioVideo, platforms: string[]): Platform[] {
  const picked = PLACES[v.format].filter((p) => platforms.includes(p));
  if (!picked.length) throw new Error("Pick at least one place");
  return picked;
}

/** Changes where a video goes. Places it already went to stay; a removed place loses its slot. */
export async function setPlaces(store: StudioStore, actor: Actor, id: string, platforms: string[], now = new Date()): Promise<StudioVideo> {
  assertStudio(actor, "make_videos");
  const v = await mustGet(store, id);
  const picked = pickPlaces(v, platforms);
  const targets = PLACES[v.format].filter((p) => picked.includes(p) || postedOn(v, p));
  const at = now.toISOString();
  const saved = await store.saveVideo(withSlots({ ...v, targets }, (v.slots ?? []).filter((s) => targets.includes(s.platform)), at, { at, by: actor.userId, event: "places_changed", note: targets.join(", ") }));
  await fillSlots(store, now);
  return (await store.getVideo(id)) ?? saved;
}

/**
 * Posts an approved video now to the picked places instead of waiting for its slot. Follows the
 * publish mode like the schedule does: while publishing is off it only logs.
 */
export async function postNow(store: StudioStore, actor: Actor, id: string, platforms: string[], deps: PublishDeps = {}): Promise<StudioVideo> {
  assertStudio(actor, "make_videos");
  const mode = deps.mode ?? publishMode();
  const now = deps.now ?? new Date();
  const v = await mustGet(store, id);
  if (!["approved", "scheduled", "published"].includes(v.stage) || !isApproved(v)) throw new Error("Only a video the attorney approved can be posted");
  if (mode !== "off" && (v.render.status !== "done" || !v.render.videoUrl)) throw new Error("This video has not been rendered yet");
  const picked = pickPlaces(v, platforms).filter((p) => !postedOn(v, p));
  if (!picked.length) throw new Error("It is already live everywhere you picked");
  const posts: PostRecord[] = [];
  for (const p of picked) posts.push(await postOne(store, v, p, mode, deps.fetch ?? fetch, now));
  const targets = [...new Set([...v.targets, ...picked])];
  // A place posted to now gives up its slot, which another video can take.
  const went = posts.filter((p) => p.status !== "failed").map((p) => p.platform);
  const slots = (v.slots ?? []).filter((s) => !went.includes(s.platform) || postedOn(v, s.platform));
  return store.saveVideo(recordPosts({ ...v, targets, slots }, posts, now.toISOString(), actor.userId, mode));
}

async function postOne(store: StudioStore, v: StudioVideo, platform: Platform, mode: PublishMode, f: typeof fetch, now: Date): Promise<PostRecord> {
  const at = now.toISOString();
  if (mode === "off") return { platform, mode, status: "logged", at };
  if (platform === "instagram" && mode === "private") return { platform, mode, status: "logged", at, error: "Instagram has no private posts; skipped until publishing is live" };
  const ch = await store.getChannel(platform);
  if (!ch || ch.status !== "connected") return { platform, mode, status: "failed", at, error: `${platform} is not connected` };
  try {
    const { tokens, refreshed } = await freshTokens(ch, f, now);
    if (refreshed) await store.saveChannel(refreshed);
    if (platform === "youtube") {
      const privacy = mode === "live" ? "public" : "private";
      const r = await uploadToYouTube(tokens.accessToken, { videoUrl: v.render.videoUrl!, title: youtubeTitle(v), description: caption(v, "youtube"), tags: v.script?.hashtags ?? [], privacy, synthetic: Boolean(v.plan?.audioSrc) && process.env.STUDIO_VOICE_SYNTHETIC !== "false" }, f);
      return { platform, mode, status: "posted", at, externalId: r.id, url: r.url, privacy };
    }
    const r = await publishToInstagram(tokens.accessToken, ch.externalId ?? "", { videoUrl: v.render.videoUrl!, caption: caption(v, "instagram") }, f);
    return { platform, mode, status: "posted", at, externalId: r.id, url: r.url, privacy: "public" };
  } catch (err) {
    return { platform, mode, status: "failed", at, error: err instanceof Error ? err.message : String(err) };
  }
}

/** What the attorney approved, for the record kept with each post (bar rules on ad retention). */
export function approvalRecord(v: StudioVideo): { hash: string; by?: string; at?: string } {
  return { hash: contentHash(v), by: v.review?.by, at: v.review?.at };
}
