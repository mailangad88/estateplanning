/**
 * Render hand-off. Videos are rendered only after the attorney approves them (the review
 * screen previews the same Remotion composition in the browser, so nothing is spent on
 * renders that get sent back). A worker (the GitHub Actions "Studio render" workflow) pulls
 * the queue, renders, stores the files and reports back here.
 */
import { timingSafeEqual } from "node:crypto";
import { contentHash, isApproved } from "./pipeline";
import type { StudioStore } from "./store";
import type { StudioVideo, VideoPlan } from "./types";

export function workerAuthorized(request: Request): boolean {
  const token = process.env.STUDIO_WORKER_TOKEN;
  if (!token) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${token}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export interface RenderJob {
  id: string;
  contentHash: string;
  plan: VideoPlan;
}

/** Approved or scheduled videos without a finished render; marks them queued. */
export async function claimRenderJobs(store: StudioStore, limit = 4, now = new Date()): Promise<RenderJob[]> {
  const stale = new Date(now.getTime() - 60 * 60_000).toISOString();
  const retryAfter = new Date(now.getTime() - 6 * 60 * 60_000).toISOString(); // failed renders retry at most every 6 hours
  const jobs = (await store.listVideos())
    .filter((v) => (v.stage === "approved" || v.stage === "scheduled") && isApproved(v) && v.plan)
    .filter((v) => v.render.status === "not_started" || (v.render.status === "failed" && v.render.updatedAt < retryAfter) || (v.render.status === "queued" && v.render.updatedAt < stale))
    .sort((a, b) => (a.slotAt ?? "9").localeCompare(b.slotAt ?? "9"))
    .slice(0, limit);
  const at = now.toISOString();
  for (const v of jobs) await store.saveVideo({ ...v, render: { status: "queued", updatedAt: at } });
  return jobs.map((v) => ({ id: v.id, contentHash: contentHash(v), plan: v.plan! }));
}

export async function recordRender(
  store: StudioStore,
  input: { id: string; contentHash: string; status: "done" | "failed"; videoUrl?: string; thumbnailUrl?: string; captionsUrl?: string; error?: string },
  now = new Date(),
): Promise<StudioVideo> {
  const v = await store.getVideo(input.id);
  if (!v) throw new Error("Video not found");
  if (contentHash(v) !== input.contentHash) throw new Error("The script changed after this render started; it will be rendered again");
  const https = (u?: string) => (u && /^https:\/\//.test(u) ? u : undefined);
  const at = now.toISOString();
  return store.saveVideo({
    ...v,
    render: input.status === "done"
      ? { status: "done", videoUrl: https(input.videoUrl), thumbnailUrl: https(input.thumbnailUrl), captionsUrl: https(input.captionsUrl), updatedAt: at }
      : { status: "failed", error: (input.error ?? "Render failed").slice(0, 500), updatedAt: at },
    updatedAt: at,
    history: [...v.history, { at, by: "system", event: `render_${input.status}`, note: input.error }],
  });
}
