/**
 * Posts due videos. With STUDIO_PUBLISH_MODE=off (the default) nothing leaves the site: each
 * due video gets a "logged" post record showing exactly what would have gone out.
 */
import { DISCLAIMER, endCard, publishMode, trackedUrl } from "./config";
import { freshTokens, publishToInstagram, uploadToYouTube } from "./channels";
import { contentHash, isApproved } from "./pipeline";
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

/** Publishes every scheduled video whose slot has passed. */
export async function publishDue(store: StudioStore, deps: PublishDeps = {}): Promise<PublishResult[]> {
  const mode = deps.mode ?? publishMode();
  const now = deps.now ?? new Date();
  const f = deps.fetch ?? fetch;
  const due = (await store.listVideos()).filter((v) => v.stage === "scheduled" && v.slotAt && new Date(v.slotAt) <= now);
  const out: PublishResult[] = [];
  for (const v of due) {
    const at = now.toISOString();
    if (!isApproved(v)) {
      // The script changed after approval (or the approval was not an attorney's): back to review.
      await store.saveVideo({ ...v, stage: "in_review", slotAt: undefined, review: undefined, updatedAt: at, history: [...v.history, { at, by: "system", event: "unscheduled", note: "Approval no longer matches the script" }] });
      out.push({ id: v.id, posts: [], skipped: "approval no longer matches" });
      continue;
    }
    if (mode !== "off" && (v.render.status !== "done" || !v.render.videoUrl)) {
      out.push({ id: v.id, posts: [], skipped: "not rendered yet" });
      continue;
    }
    const posts: PostRecord[] = [];
    for (const platform of v.targets) {
      if (v.posts.some((p) => p.platform === platform && p.status !== "failed")) continue;
      posts.push(await postOne(store, v, platform, mode, f, now));
    }
    const all = [...v.posts, ...posts];
    const finished = v.targets.every((p) => all.some((x) => x.platform === p && x.status !== "failed"));
    await store.saveVideo({
      ...v,
      posts: all,
      stage: finished ? "published" : "scheduled",
      updatedAt: at,
      history: [...v.history, ...posts.map((p) => ({ at, by: "system", event: `${p.platform}_${p.status}`, note: p.error ?? p.url ?? (p.status === "logged" ? `Publishing is ${mode}` : undefined) }))],
    });
    out.push({ id: v.id, posts });
  }
  return out;
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
