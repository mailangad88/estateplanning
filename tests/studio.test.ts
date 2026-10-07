import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/server/auth/policy";
import { actorFor, DEMO_USERS } from "@/server/seed";
import { openTokens, publishToInstagram, sealTokens, uploadToYouTube } from "@/server/studio/channels";
import { runStudioCron } from "@/server/studio/cron";
import { chunkNarration, direct, planSeconds } from "@/server/studio/director";
import { contentHash, editScript, generateDrafts, isApproved, review } from "@/server/studio/pipeline";
import { caption, publishDue } from "@/server/studio/publish";
import { checkScript } from "@/server/studio/quality";
import { claimRenderJobs, recordRender } from "@/server/studio/render";
import { fillSlots, saveSettings, slots, zonedToUtc } from "@/server/studio/schedule";
import { createMemoryStudioStore, type StudioStore } from "@/server/studio/store";
import { allTopics, pickTopics } from "@/server/studio/topics";
import type { StudioVideo } from "@/server/studio/types";
import { headline, SiteDraftWriter } from "@/server/studio/writer";
import { DEFAULT_SETTINGS } from "@/server/studio/config";
import type { Actor } from "@/server/types";

const NOW = new Date("2026-10-07T14:00:00Z");
const user = (role: string): Actor => actorFor(DEMO_USERS.find((u) => u.role === role)!);
const writer = new SiteDraftWriter();
let store: StudioStore;

beforeEach(() => {
  store = createMemoryStudioStore();
});

async function approved(format: "long" | "short" = "short"): Promise<StudioVideo> {
  const [v] = await generateDrafts(store, user("marketing"), { format, count: 1, writer, now: NOW });
  expect(v.stage).toBe("in_review");
  return review(store, user("attorney"), v.id, { decision: "approved", contentHash: contentHash(v), confirmed: true }, NOW);
}

describe("topics", () => {
  it("puts Illinois first and skips other states' law", () => {
    const picked = pickTopics([], "short", 5, { needsPage: true });
    expect(picked[0].state).toBe("IL");
    expect(allTopics().some((t) => /\b(California|Texas|Florida)\b/.test(t.question))).toBe(false);
  });

  it("never repeats a question for the same format", async () => {
    await generateDrafts(store, user("marketing"), { format: "short", count: 5, writer, now: NOW });
    const again = pickTopics(await store.listVideos(), "short", 5, { needsPage: true });
    const used = new Set((await store.listVideos()).map((v) => v.topic.question));
    expect(again.some((t) => used.has(t.question))).toBe(false);
  });
});

describe("site-draft writer and quality gates", () => {
  it("drafts long and short videos that pass the blocking checks", async () => {
    const longs = await generateDrafts(store, user("marketing"), { format: "long", count: 6, writer, now: NOW });
    const shorts = await generateDrafts(store, user("marketing"), { format: "short", count: 6, writer, now: NOW });
    for (const v of [...longs, ...shorts]) {
      expect(v.stage, `${v.topic.question}: ${JSON.stringify(v.quality?.checks.filter((c) => !c.ok))}`).toBe("in_review");
      expect(v.research?.sources.length).toBeGreaterThan(0);
      expect(v.script?.beats.at(-1)?.role).toBe("cta");
    }
    for (const v of shorts) expect(planSeconds(v.plan!)).toBeLessThanOrEqual(58);
    for (const v of longs) expect(planSeconds(v.plan!)).toBeGreaterThan(240);
  });

  it("blocks banned advertising words, filler and unsourced claims", async () => {
    const [v] = await generateDrafts(store, user("marketing"), { format: "short", count: 1, writer, now: NOW });
    const script = structuredClone(v.script!);
    script.beats[1].narration += " Our expert team will guarantee it. Let's dive in.";
    script.beats[1].sourceIds = [];
    const q = checkScript({ format: "short", script, research: v.research! });
    const failed = q.checks.filter((c) => !c.ok && c.level === "block").map((c) => c.id);
    expect(q.passed).toBe(false);
    expect(failed).toEqual(expect.arrayContaining(["advertising_words", "filler_phrases", "claims_sourced"]));
  });

  it("requires fictional examples to be labelled", async () => {
    const [v] = await generateDrafts(store, user("marketing"), { format: "short", count: 1, writer, now: NOW });
    const script = structuredClone(v.script!);
    script.beats.splice(2, 0, { id: "bx", role: "example", narration: "Say Maria and Tom own a house in Peoria.", onScreen: "An example", sourceIds: ["s1"] });
    expect(checkScript({ format: "short", script, research: v.research! }).checks.find((c) => c.id === "fictional_labelled")?.ok).toBe(false);
  });
});

describe("on-screen headlines", () => {
  it("never cut mid-phrase or inside a number", () => {
    expect(headline("The 2026 federal exclusion is $15,000,000 per person, and couples can combine theirs")).toBe("The 2026 federal exclusion is $15,000,000 per person");
    expect(headline("A very long heading that has no natural break anywhere in it at all", 8, "How it works")).toBe("How it works");
    expect(headline("Short and sweet.")).toBe("Short and sweet");
  });
});

describe("director", () => {
  it("splits long narration into scenes of whole sentences", () => {
    const chunks = chunkNarration("One two three. Four five six seven. Eight nine.", 5);
    expect(chunks).toEqual(["One two three.", "Four five six seven.", "Eight nine."]);
  });

  it("is deterministic, so an approval covers exactly what renders", async () => {
    const [v] = await generateDrafts(store, user("marketing"), { format: "long", count: 1, writer, now: NOW });
    const again = direct({ format: "long", topic: v.topic, script: v.script! });
    expect(again).toEqual(v.plan);
    expect(again.width).toBe(1920);
    expect(again.scenes.at(-1)?.template).toBe("cta");
  });
});

describe("review", () => {
  it("lets only marketing and admins make drafts, and only attorneys approve", async () => {
    await expect(generateDrafts(store, user("attorney"), { format: "short", count: 1, writer })).rejects.toThrow(ForbiddenError);
    const [v] = await generateDrafts(store, user("marketing"), { format: "short", count: 1, writer, now: NOW });
    await expect(review(store, user("marketing"), v.id, { decision: "approved", contentHash: contentHash(v), confirmed: true })).rejects.toThrow(ForbiddenError);
    const byAdmin = await review(store, user("platform_admin"), v.id, { decision: "approved", contentHash: contentHash(v), confirmed: true });
    expect(byAdmin.stage).toBe("in_review");
    expect(isApproved(byAdmin)).toBe(false);
    const byAttorney = await review(store, user("attorney"), v.id, { decision: "approved", contentHash: contentHash(v), confirmed: true });
    expect(byAttorney.stage).toBe("approved");
    expect(isApproved(byAttorney)).toBe(true);
  });

  it("needs a second factor", async () => {
    const [v] = await generateDrafts(store, user("marketing"), { format: "short", count: 1, writer, now: NOW });
    const noMfa = { ...user("attorney"), mfa: false };
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      await expect(review(store, noMfa, v.id, { decision: "approved", contentHash: contentHash(v), confirmed: true })).rejects.toThrow(/Two-step/);
    } finally {
      env.NODE_ENV = prev;
    }
  });

  it("refuses an approval for a script that changed, and an edit clears the approval", async () => {
    const v = await approved();
    const script = structuredClone(v.script!);
    script.description = "Edited description.";
    const edited = await editScript(store, user("marketing"), v.id, script, NOW);
    expect(edited.stage).toBe("in_review");
    expect(isApproved(edited)).toBe(false);
    await expect(review(store, user("attorney"), v.id, { decision: "approved", contentHash: contentHash(v), confirmed: true })).rejects.toThrow(/changed/);
  });

  it("requires a note when sending back", async () => {
    const [v] = await generateDrafts(store, user("marketing"), { format: "short", count: 1, writer, now: NOW });
    await expect(review(store, user("attorney"), v.id, { decision: "changes_requested", contentHash: contentHash(v), confirmed: false })).rejects.toThrow(/note/);
    const back = await review(store, user("attorney"), v.id, { decision: "changes_requested", contentHash: contentHash(v), confirmed: false, note: "Shorter hook" });
    expect(back.stage).toBe("changes_requested");
  });
});

describe("schedule", () => {
  it("converts Chicago slot times to UTC across daylight saving", () => {
    expect(zonedToUtc("2026-10-07", "10:00", "America/Chicago").toISOString()).toBe("2026-10-07T15:00:00.000Z");
    expect(zonedToUtc("2026-12-07", "10:00", "America/Chicago").toISOString()).toBe("2026-12-07T16:00:00.000Z");
  });

  it("offers 2 long and 6 short slots a day by default", () => {
    const day = slots(DEFAULT_SETTINGS, new Date("2026-10-07T05:00:00Z"), 1);
    expect(day.filter((s) => s.format === "long")).toHaveLength(2);
    expect(day.filter((s) => s.format === "short")).toHaveLength(6);
  });

  it("puts approved videos in the next open slot of their format", async () => {
    const a = await approved("short");
    const b = await approved("long");
    const done = await fillSlots(store, NOW);
    expect(done.map((v) => v.id).sort()).toEqual([a.id, b.id].sort());
    const short = (await store.getVideo(a.id))!;
    expect(short.stage).toBe("scheduled");
    expect(new Date(short.slotAt!).getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("validates slot times and limits who changes them", async () => {
    await expect(saveSettings(store, user("marketing"), { longSlots: ["10:00"], shortSlots: [] })).rejects.toThrow(ForbiddenError);
    await expect(saveSettings(store, user("platform_admin"), { longSlots: ["25:00"], shortSlots: [] })).rejects.toThrow(/not a time/);
    const s = await saveSettings(store, user("platform_admin"), { longSlots: ["18:00", "09:00"], shortSlots: ["12:00"] }, NOW);
    expect(s.longSlots).toEqual(["09:00", "18:00"]);
  });
});

describe("publishing", () => {
  it("only logs while publishing is off", async () => {
    await approved("short");
    await fillSlots(store, NOW);
    const later = new Date(NOW.getTime() + 3 * 86_400_000);
    const out = await publishDue(store, { mode: "off", now: later, fetch: () => { throw new Error("no network"); } });
    expect(out[0].posts.map((p) => [p.platform, p.status])).toEqual([["youtube", "logged"], ["instagram", "logged"]]);
    expect((await store.getVideo(out[0].id))!.stage).toBe("published");
  });

  it("pulls a video back to review when its script changed after approval", async () => {
    const v = await approved("short");
    await fillSlots(store, NOW);
    const s = (await store.getVideo(v.id))!;
    await store.saveVideo({ ...s, script: { ...s.script!, title: "Changed behind the review" } });
    const out = await publishDue(store, { mode: "off", now: new Date(NOW.getTime() + 3 * 86_400_000) });
    expect(out[0].skipped).toMatch(/approval/);
    expect((await store.getVideo(v.id))!.stage).toBe("in_review");
  });

  it("uploads to YouTube as private and skips Instagram in private mode", async () => {
    const v = await approved("short");
    await fillSlots(store, NOW);
    const s = (await store.getVideo(v.id))!;
    await store.saveVideo({ ...s, render: { status: "done", videoUrl: "https://media.example.com/v.mp4", updatedAt: NOW.toISOString() } });
    await store.saveChannel({ id: "youtube", platform: "youtube", status: "connected", externalId: "UC1", sealedTokens: sealTokens("youtube", { accessToken: "tok", refreshToken: "r", expiresAt: "2030-01-01T00:00:00Z" }) });
    const calls: { url: string; body?: string }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: typeof init?.body === "string" ? init.body : undefined });
      if (String(url).startsWith("https://media.example.com")) return new Response(new Uint8Array([1, 2, 3]));
      if (String(url).includes("uploadType=resumable")) return new Response(null, { status: 200, headers: { location: "https://upload.example/session" } });
      return Response.json({ id: "yt123" });
    }) as typeof fetch;
    const out = await publishDue(store, { mode: "private", now: new Date(NOW.getTime() + 3 * 86_400_000), fetch: fake });
    const yt = out[0].posts.find((p) => p.platform === "youtube")!;
    expect(yt).toMatchObject({ status: "posted", privacy: "private", externalId: "yt123" });
    expect(out[0].posts.find((p) => p.platform === "instagram")?.status).toBe("logged");
    const meta = JSON.parse(calls.find((c) => c.url.includes("uploadType=resumable"))!.body!);
    expect(meta.status.privacyStatus).toBe("private");
    expect(meta.snippet.title).toMatch(/#Shorts$/);
  });

  it("publishes an Instagram Reel through a container", async () => {
    const seen: string[] = [];
    let polls = 0;
    const fake = (async (url: string) => {
      seen.push(String(url).split("?")[0]);
      if (String(url).includes("status_code")) return Response.json({ status_code: ++polls > 1 ? "FINISHED" : "IN_PROGRESS" });
      if (String(url).includes("permalink")) return Response.json({ permalink: "https://instagram.com/reel/x" });
      if (String(url).endsWith("/media_publish")) return Response.json({ id: "ig-post" });
      return Response.json({ id: "container" });
    }) as typeof fetch;
    const r = await publishToInstagram("tok", "17841", { videoUrl: "https://media.example.com/v.mp4", caption: "Hi" }, fake, async () => {});
    expect(r).toEqual({ id: "ig-post", url: "https://instagram.com/reel/x" });
    expect(seen.filter((u) => u.endsWith("/17841/media"))).toHaveLength(1);
  });

  it("captions carry the tracked booking link, disclaimer and firm details", async () => {
    const v = await approved("short");
    const c = caption(v, "instagram");
    expect(c).toMatch(/utm_source=instagram/);
    expect(c).toMatch(/utm_content=vid_/);
    expect(c).toMatch(/not legal advice/);
    expect(c).toMatch(/Attorney advertising/);
  });

  it("refuses to upload a video file it cannot read", async () => {
    const fake = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    await expect(uploadToYouTube("tok", { videoUrl: "https://x/v.mp4", title: "t", description: "d", tags: [], privacy: "private", synthetic: false }, fake)).rejects.toThrow(/rendered video/);
  });
});

describe("render hand-off and tokens", () => {
  it("queues only attorney-approved videos and rejects stale results", async () => {
    await generateDrafts(store, user("marketing"), { format: "short", count: 1, writer, now: NOW });
    const v = await approved("short");
    const jobs = await claimRenderJobs(store, 5, NOW);
    expect(jobs.map((j) => j.id)).toEqual([v.id]);
    await expect(recordRender(store, { id: v.id, contentHash: "stale", status: "done", videoUrl: "https://x/v.mp4" })).rejects.toThrow(/changed/);
    const done = await recordRender(store, { id: v.id, contentHash: jobs[0].contentHash, status: "done", videoUrl: "https://x/v.mp4", thumbnailUrl: "http://insecure/t.jpg" });
    expect(done.render).toMatchObject({ status: "done", videoUrl: "https://x/v.mp4", thumbnailUrl: undefined });
  });

  it("seals channel tokens so the stored value is not readable", () => {
    const sealed = sealTokens("youtube", { accessToken: "secret-token", expiresAt: "2030-01-01T00:00:00Z" });
    expect(sealed).not.toContain("secret-token");
    expect(openTokens("youtube", sealed).accessToken).toBe("secret-token");
    expect(() => openTokens("instagram", sealed)).toThrow();
  });

  it("runs the cron: drafts when asked, schedules, logs posts", async () => {
    const out = await runStudioCron(store, { autoDraft: true, writer, publish: { mode: "off" }, now: NOW });
    expect(out.drafted.long + out.drafted.short).toBeGreaterThan(0);
    expect(out.scheduled).toEqual([]); // nothing approved yet
  });
});
