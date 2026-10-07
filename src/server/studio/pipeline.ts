/**
 * The studio pipeline: create drafts, edit, review, schedule. Every state change is
 * recorded in the video's history with who did it.
 */
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "@/server/types";
import { approvalCounts, assertStudio } from "./access";
import { direct } from "./director";
import { checkScript } from "./quality";
import type { StudioStore } from "./store";
import { pickTopics } from "./topics";
import type { Platform, ReviewDecision, Script, StudioVideo, Topic, VideoFormat } from "./types";
import { writerFromEnv, type Writer } from "./writer";

export function contentHash(v: Pick<StudioVideo, "script" | "plan">): string {
  return createHash("sha256").update(JSON.stringify({ script: v.script, plan: v.plan })).digest("hex");
}

/** True only while an attorney's approval matches the script and plan exactly as they are now. */
export function isApproved(v: StudioVideo): boolean {
  return v.review?.decision === "approved" && approvalCounts(v.review.role) && v.review.contentHash === contentHash(v);
}

const TARGETS: Record<VideoFormat, Platform[]> = { long: ["youtube"], short: ["youtube", "instagram"] };

function newVideo(topic: Topic, format: VideoFormat, by: string, now: Date): StudioVideo {
  const at = now.toISOString();
  return {
    id: `vid_${randomUUID().slice(0, 12)}`,
    format,
    topic,
    stage: "idea",
    render: { status: "not_started", updatedAt: at },
    targets: TARGETS[format],
    posts: [],
    history: [{ at, by, event: "created", note: topic.question }],
    createdAt: at,
    updatedAt: at,
  };
}

/** Research, script, edit and direct one video. Leaves it in_review or needs_rewrite. */
export async function writeVideo(store: StudioStore, video: StudioVideo, writer: Writer, by: string, now = new Date()): Promise<StudioVideo> {
  const at = now.toISOString();
  try {
    const draft = await writer.draft(video.topic, video.format);
    const plan = direct({ format: video.format, topic: video.topic, script: draft.script });
    const others = (await store.listVideos()).filter((o) => o.id !== video.id && o.script).map((o) => o.script!.title);
    const quality = checkScript({ format: video.format, script: draft.script, research: draft.research, plan, editorNotes: draft.editorNotes, otherTitles: others });
    const next: StudioVideo = {
      ...video,
      research: draft.research,
      script: draft.script,
      plan,
      quality,
      review: undefined,
      stage: quality.passed ? "in_review" : "needs_rewrite",
      updatedAt: at,
      history: [...video.history, { at, by, event: quality.passed ? "written" : "failed_checks", note: `${writer.name}${quality.passed ? "" : `: ${quality.checks.filter((c) => !c.ok && c.level === "block").map((c) => c.id).join(", ")}`}` }],
    };
    return store.saveVideo(next);
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err);
    return store.saveVideo({ ...video, stage: "needs_rewrite", updatedAt: at, history: [...video.history, { at, by, event: "write_failed", note }] });
  }
}

/**
 * Makes new drafts. With the free site-draft writer only questions our site already answers
 * can be drafted; the Claude writer can take any question.
 */
export async function generateDrafts(store: StudioStore, actor: Actor | null, input: { format: VideoFormat; count: number; writer?: Writer; now?: Date }): Promise<StudioVideo[]> {
  if (actor) assertStudio(actor, "make_videos");
  const by = actor?.userId ?? "system";
  const writer = input.writer ?? writerFromEnv();
  const now = input.now ?? new Date();
  const existing = await store.listVideos();
  const topics = pickTopics(existing, input.format, Math.min(Math.max(input.count, 1), 20), { needsPage: writer.name === "site-draft" });
  const out: StudioVideo[] = [];
  for (const topic of topics) {
    const v = await store.saveVideo(newVideo(topic, input.format, by, now));
    out.push(await writeVideo(store, v, writer, by, now));
  }
  return out;
}

/** Hand edit of the script (marketing). Re-directs, re-checks and clears any approval. */
export async function editScript(store: StudioStore, actor: Actor, id: string, script: Script, now = new Date()): Promise<StudioVideo> {
  assertStudio(actor, "make_videos");
  const v = await mustGet(store, id);
  if (v.stage === "published") throw new Error("This video is already published");
  if (!v.research) throw new Error("This video has no research yet");
  const plan = direct({ format: v.format, topic: v.topic, script });
  const quality = checkScript({ format: v.format, script, research: v.research, plan, editorNotes: v.quality?.editorNotes });
  const at = now.toISOString();
  return store.saveVideo({
    ...v,
    script,
    plan,
    quality,
    review: undefined,
    slotAt: undefined,
    slots: undefined,
    stage: quality.passed ? "in_review" : "needs_rewrite",
    render: { status: "not_started", updatedAt: at },
    updatedAt: at,
    history: [...v.history, { at, by: actor.userId, event: "edited", note: v.review?.decision === "approved" ? "Approval cleared by the edit" : undefined }],
  });
}

/** Rewrite from scratch with the current writer (after changes were requested or checks failed). */
export async function rewrite(store: StudioStore, actor: Actor, id: string, writer: Writer = writerFromEnv()): Promise<StudioVideo> {
  assertStudio(actor, "make_videos");
  const v = await mustGet(store, id);
  if (v.stage === "published") throw new Error("This video is already published");
  return writeVideo(store, { ...v, slotAt: undefined, slots: undefined }, writer, actor.userId);
}

/** Attorney decision, tied to the exact script and plan on screen (contentHash). */
export async function review(
  store: StudioStore,
  actor: Actor,
  id: string,
  input: { decision: ReviewDecision["decision"]; contentHash: string; note?: string; confirmed: boolean },
  now = new Date(),
): Promise<StudioVideo> {
  assertStudio(actor, "review_videos");
  const v = await mustGet(store, id);
  if (!["in_review", "changes_requested", "approved", "scheduled"].includes(v.stage)) throw new Error("This video is not waiting for review");
  if (input.contentHash !== contentHash(v)) throw new Error("The script changed while you were reading it. Reload and review the current version.");
  if (input.decision === "approved" && !input.confirmed) throw new Error("Tick the box to confirm you watched or read the whole video");
  if (input.decision !== "approved" && !input.note?.trim()) throw new Error("Add a note saying what to change");
  const at = now.toISOString();
  const decision: ReviewDecision = { decision: input.decision, by: actor.userId, role: actor.role, at, note: input.note?.trim() || undefined, contentHash: input.contentHash };
  const counts = input.decision === "approved" && approvalCounts(actor.role);
  const stage = input.decision === "approved" ? (counts ? "approved" : v.stage) : input.decision === "rejected" ? "rejected" : "changes_requested";
  return store.saveVideo({
    ...v,
    review: decision,
    stage: stage === "approved" && v.stage === "scheduled" ? "scheduled" : stage,
    slotAt: stage === "approved" || stage === "scheduled" ? v.slotAt : undefined,
    slots: stage === "approved" || stage === "scheduled" ? v.slots : undefined,
    updatedAt: at,
    history: [...v.history, { at, by: actor.userId, event: input.decision, note: counts || input.decision !== "approved" ? input.note : "Recorded; only an attorney's approval clears a video to publish" }],
  });
}

export async function mustGet(store: StudioStore, id: string): Promise<StudioVideo> {
  const v = await store.getVideo(id);
  if (!v) throw new Error("Video not found");
  return v;
}
