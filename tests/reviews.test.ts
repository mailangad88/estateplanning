import { describe, expect, it } from "vitest";
import { buildConsentRecord } from "@/lib/consent";
import { ForbiddenError } from "@/server/auth/policy";
import { runAutomations } from "@/server/automation";
import { createMemoryDb, type Db } from "@/server/db";
import { applyOptOut } from "@/server/nurture/compliance";
import {
  REVIEW_POSTED_TAG,
  handleReviewReply,
  holdReview,
  isPostedReply,
  markReviewPosted,
  optOutOfReviews,
  releaseReviewHold,
  reviewTrackingReport,
  syncReviewRequests,
} from "@/server/nurture/reviews";
import { enroll, evaluateSends, markSent, onStageChange } from "@/server/nurture/scheduler";
import { SEQUENCES, getSequence } from "@/server/nurture/sequences";
import { actorFor, DEMO_USERS } from "@/server/seed";
import type { Lead, MatterType, Person } from "@/server/types";

const T0 = new Date("2026-10-06T17:00:00Z"); // 12:00 Central: inside every send window
const DAY = 86_400_000;
const plus = (d: number) => new Date(T0.getTime() + d * DAY);
const admin = actorFor(DEMO_USERS.find((u) => u.id === "u-admin")!);
const firmAdmin = actorFor(DEMO_USERS.find((u) => u.id === "u-firmadmin")!);
const intake = actorFor(DEMO_USERS.find((u) => u.id === "u-intake")!);
const marketing = actorFor(DEMO_USERS.find((u) => u.id === "u-marketing")!);

async function addClient(db: Db, o: { id?: string; sms?: boolean; segments?: string[]; matterType?: MatterType; firmId?: string; signedAt?: Date; capture?: Lead["capture"] } = {}): Promise<Lead> {
  const id = o.id ?? "l1";
  const person: Person = { id: `p-${id}`, firstName: "Dana", lastName: "Lee", email: `dana.${id}@example.com`, phone: `51255501${(id.replace(/\D/g, "") || String(id.charCodeAt(0))).padStart(2, "0").slice(-2)}`, language: "English", state: "TX" };
  await db.persons.insert(person);
  const signed = (o.signedAt ?? T0).toISOString();
  const lead: Lead = {
    id,
    personId: person.id,
    createdAt: new Date(T0.getTime() - 30 * DAY).toISOString(),
    stage: "plan_complete",
    stageHistory: [{ stage: "new", at: new Date(T0.getTime() - 30 * DAY).toISOString(), by: "system" }, { stage: "plan_complete", at: signed, by: "u" }],
    matterType: o.matterType ?? "new_plan",
    state: "TX",
    urgent: false,
    score: { score: 60, tier: "warm", grade: "B", urgent: false, components: [], redFlags: [] },
    segments: o.segments ?? [],
    source: {},
    consent: buildConsentRecord({ smsConsent: o.sms ?? true, acknowledgedNoRelationship: true, pageUrl: "https://x.test", ip: null, userAgent: null, now: T0 }),
    offerSummary: "",
    conflictCard: { clientName: "Dana Lee", parties: [], matterType: o.matterType ?? "new_plan", state: "TX", clearance: "pending" },
    intake: { summary: "", redFlags: [], deadlines: [], household: { members: [] }, assets: {}, answers: {} },
    firmId: o.firmId,
    capture: o.capture,
  };
  await db.leads.insert(lead);
  return lead;
}

/** Signing happens: the stage hook starts the request. */
async function sign(db: Db, id = "l1", at = T0) {
  await onStageChange(db, id, "plan_complete", at);
}

const dueIds = async (db: Db, when: Date) => (await evaluateSends(db, when)).due.filter((d) => d.stepId.startsWith("rr_")).map((d) => d.stepId);

describe("review_request sequence definition", () => {
  const seq = getSequence("review_request")!;

  it("follows Sequence F: email at T+14, one reminder at T+21 (text or email), nothing after", () => {
    expect(seq.trigger).toMatchObject({ kind: "stage", stage: "plan_complete" });
    expect(seq.steps.map((s) => [s.id, s.channel, s.offset.days])).toEqual([
      ["rr_email_t14", "email", 14],
      ["rr_reminder_sms_t21", "sms", 21],
      ["rr_reminder_email_t21", "email", 21],
    ]);
    expect(seq.steps.every((s) => s.review === true && s.requiresApproval && s.brainFileEntryIds.length > 0)).toBe(true);
  });

  it("has no segment, sentiment or engagement conditions on any step", () => {
    for (const s of seq.steps) {
      expect(s.onlySegments, s.id).toBeUndefined();
      expect(s.exceptSegments, s.id).toBeUndefined();
    }
    expect(seq.exitWhen.map((e) => e.kind)).toEqual(["unsubscribed"]);
  });

  it("replaces the old T+7 review step in plan_complete", () => {
    expect(SEQUENCES.flatMap((s) => s.steps).filter((s) => s.id === "pc_review_request")).toHaveLength(0);
  });
});

describe("review requests", () => {
  it("signing tracks the client and enrolls them; nothing is due before T+14", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    const row = (await db.reviewRequests.get("review-l1"))!;
    expect(row).toMatchObject({ eligible: true, anchorAt: T0.toISOString(), matterType: "new_plan" });
    expect((await db.enrollments.list((e) => e.sequenceId === "review_request" && e.status === "active")).length).toBe(1);
    expect(await dueIds(db, plus(13.9))).toEqual([]);
    expect(await dueIds(db, plus(14))).toEqual(["rr_email_t14"]);
  });

  it("asks everyone: a negative private check-in or complaint changes nothing", async () => {
    const db = createMemoryDb();
    await addClient(db, { id: "happy" });
    await addClient(db, { id: "unhappy" });
    await db.activities.insert({ id: "a1", leadId: "unhappy", kind: "email", direction: "inbound", at: plus(7).toISOString(), summary: "Very unhappy with how this went, want a refund" });
    await db.comments.insert({ id: "c1", leadId: "unhappy", authorId: "u", authorName: "U", body: "complaint", visibility: "internal", mentions: [], createdAt: plus(8).toISOString() });
    await sign(db, "happy");
    await sign(db, "unhappy");
    const due = (await evaluateSends(db, plus(14))).due.filter((d) => d.stepId === "rr_email_t14");
    expect(due.map((d) => d.leadId).sort()).toEqual(["happy", "unhappy"]);
  });

  it("reminds by text when the client gave SMS consent, and by email when not (never both)", async () => {
    const db = createMemoryDb();
    await addClient(db, { id: "text", sms: true });
    await addClient(db, { id: "mail", sms: false });
    await sign(db, "text");
    await sign(db, "mail");
    for (const e of await db.enrollments.list()) if (e.sequenceId === "review_request") await markSent(db, e.id, "rr_email_t14", plus(14));
    const ev = await evaluateSends(db, plus(21));
    const by = (id: string) => ev.due.filter((d) => d.leadId === id && d.stepId.startsWith("rr_")).map((d) => d.stepId);
    expect(by("text")).toEqual(["rr_reminder_sms_t21"]);
    expect(by("mail")).toEqual(["rr_reminder_email_t21"]);
    const skipped = (await db.enrollments.list((e) => e.leadId === "mail" && e.sequenceId === "review_request"))[0].skipped!;
    expect(skipped).toEqual([expect.objectContaining({ stepId: "rr_reminder_sms_t21", reason: "no_sms_consent" })]);
  });

  it("records asked and reminded on the tracking row when the sender reports them", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    const enr = (await db.enrollments.list((e) => e.sequenceId === "review_request"))[0];
    await markSent(db, enr.id, "rr_email_t14", plus(14));
    await markSent(db, enr.id, "rr_reminder_sms_t21", plus(21));
    expect(await db.reviewRequests.get("review-l1")).toMatchObject({ askedAt: plus(14).toISOString(), remindedAt: plus(21).toISOString(), reminderChannel: "sms" });
    expect((await db.audit.list((e) => e.action.startsWith("review."))).map((e) => e.action)).toEqual(["review.tracked", "review.asked", "review.reminded"]);
    // After the reminder: nothing more, ever.
    expect(await dueIds(db, plus(200))).toEqual([]);
    expect((await db.enrollments.get(enr.id))!.status).toBe("completed");
  });

  it("a STOP between the ask and the reminder ends it on every channel", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    const enr = (await db.enrollments.list((e) => e.sequenceId === "review_request"))[0];
    await markSent(db, enr.id, "rr_email_t14", plus(14));
    await applyOptOut(db, { channel: "sms", address: "5125550101", text: "STOP", at: plus(15) });
    expect(await dueIds(db, plus(21))).toEqual([]);
    expect((await db.enrollments.get(enr.id))!.status).toBe("stopped");
    expect((await db.enrollments.get(enr.id))!.stoppedReason).toBe("exit:opted_out");
    expect((await db.reviewRequests.get("review-l1"))!.optedOutAt).toBeDefined();
  });

  it("an opt-out before signing excludes with OPTOUT and nothing is sent", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await applyOptOut(db, { channel: "email", address: "dana.l1@example.com", text: "unsubscribe", at: plus(-3) });
    await sign(db);
    expect(await db.reviewRequests.get("review-l1")).toMatchObject({ eligible: false, exclusionCode: "OPTOUT" });
    expect(await dueIds(db, plus(30))).toEqual([]);
  });

  it("a client's own 'do not ask me about reviews' stops it", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    await optOutOfReviews(db, "system", "l1", plus(2), "preferences");
    expect(await dueIds(db, plus(14))).toEqual([]);
    expect((await db.audit.list((e) => e.action === "review.opted_out")).length).toBe(1);
  });
});

describe("'I posted'", () => {
  it("recognizes a client saying they posted, and not one saying they will not", () => {
    for (const t of ["I posted", "Posted!", "already posted, thanks", "I left a review", "I wrote a review", "Done", "just reviewed you", "I already reviewed"]) expect(isPostedReply(t), t).toBe(true);
    for (const t of ["I haven't posted yet", "I will post later", "I didn't leave a review", "What review?", "please call me about my trust", "not posted", "STOP", "I might post a review next week when I have time to think about what to write"]) expect(isPostedReply(t), t).toBe(false);
  });

  it("tags the lead, stops the reminder and records it", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    const enr = (await db.enrollments.list((e) => e.sequenceId === "review_request"))[0];
    await markSent(db, enr.id, "rr_email_t14", plus(14));
    expect(await handleReviewReply(db, { leadId: "l1", channel: "sms", text: "I posted", at: plus(16) })).toBe("posted");
    expect((await db.leads.get("l1"))!.segments).toContain(REVIEW_POSTED_TAG);
    expect(await dueIds(db, plus(21))).toEqual([]);
    expect((await db.enrollments.get(enr.id))!.status).toBe("stopped");
    expect((await db.reviewRequests.get("review-l1"))!.postedAt).toBe(plus(16).toISOString());
    // Idempotent
    await markReviewPosted(db, admin, "l1", plus(17));
    expect((await db.reviewRequests.get("review-l1"))!.postedAt).toBe(plus(16).toISOString());
  });

  it("a staff-applied tag in the CRM also stops the reminder", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    await db.leads.update("l1", { segments: [REVIEW_POSTED_TAG] });
    expect(await dueIds(db, plus(21))).toEqual([]);
    expect((await db.reviewRequests.get("review-l1"))!.postedAt).toBeDefined();
  });

  it("STOP replies run the shared opt-out and stop review requests", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    expect(await handleReviewReply(db, { leadId: "l1", channel: "sms", text: "STOP", at: plus(15) })).toBe("opted_out");
    expect(await db.suppressions.get("sms:5125550101")).toBeDefined();
    expect(await dueIds(db, plus(21))).toEqual([]);
    expect(await handleReviewReply(db, { leadId: "l1", channel: "sms", text: "thanks!", at: plus(16) })).toBe("none");
  });

  it("only staff who handle reviews may record it, and a firm admin only for their own firm", async () => {
    const db = createMemoryDb();
    await addClient(db, { firmId: "firm-demo" });
    await sign(db);
    await expect(markReviewPosted(db, marketing, "l1", plus(1))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(markReviewPosted(db, { ...firmAdmin, firmId: "other" }, "l1", plus(1))).rejects.toBeInstanceOf(ForbiddenError);
    expect((await markReviewPosted(db, firmAdmin, "l1", plus(1))).postedAt).toBeDefined();
  });
});

describe("who is never asked", () => {
  it("excludes grief and sensitive tracks by written rule, and enrolls nobody", async () => {
    const db = createMemoryDb();
    await addClient(db, { id: "g1", matterType: "administration" });
    await addClient(db, { id: "g2", segments: ["estate_administration"] });
    await addClient(db, { id: "g3", capture: { tool: "cost_calculator", result: { mode: "heir" } } });
    await addClient(db, { id: "s1", segments: ["special_needs"] });
    await addClient(db, { id: "s2", segments: ["widowed"] });
    await addClient(db, { id: "s3", segments: ["caregiver"] });
    await addClient(db, { id: "ok", segments: ["homeowner"] });
    for (const id of ["g1", "g2", "g3", "s1", "s2", "s3", "ok"]) await sign(db, id);
    const codes = Object.fromEntries((await db.reviewRequests.list()).map((r) => [r.leadId, r.exclusionCode ?? "eligible"]));
    expect(codes).toEqual({ g1: "UNIFORM_HOLD", g2: "UNIFORM_HOLD", g3: "UNIFORM_HOLD", s1: "SENSITIVE_TRACK", s2: "SENSITIVE_TRACK", s3: "SENSITIVE_TRACK", ok: "eligible" });
    expect(await dueIds(db, plus(30))).toEqual(["rr_email_t14", "rr_reminder_sms_t21"]);
    expect((await db.enrollments.list((e) => e.sequenceId === "review_request")).map((e) => e.leadId)).toEqual(["ok"]);
  });

  it("a sensitive tag added after signing stops the request before it goes", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    await db.leads.update("l1", { segments: ["caregiver"] });
    expect(await dueIds(db, plus(14))).toEqual([]);
    expect((await db.enrollments.list((e) => e.sequenceId === "review_request"))[0].stoppedReason).toBe("exit:sensitive_track");
  });

  it("documented attorney holds need a written reason, are logged, and a released dispute hold sends", async () => {
    const db = createMemoryDb();
    await addClient(db, { firmId: "firm-demo" });
    await sign(db);
    await expect(holdReview(db, intake, "l1", "DISPUTE_HOLD", "x", plus(1))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(holdReview(db, firmAdmin, "l1", "DISPUTE_HOLD", "  ", plus(1))).rejects.toThrow(/written reason/);
    await holdReview(db, firmAdmin, "l1", "DISPUTE_HOLD", "Open fee dispute; attorney decided to hold until resolved", plus(1));
    expect(await dueIds(db, plus(14))).toEqual([]);
    expect((await reviewTrackingReport(db, admin, plus(14))).exclusionsByCode).toEqual({ DISPUTE_HOLD: 1 });
    await releaseReviewHold(db, firmAdmin, "l1", plus(20));
    expect(await dueIds(db, plus(20))).toEqual(["rr_email_t14"]);
    expect((await db.audit.list((e) => e.action.startsWith("review.hold"))).map((e) => e.action)).toEqual(["review.hold", "review.hold_released"]);
    await expect(releaseReviewHold(db, firmAdmin, "l1", plus(21))).rejects.toThrow(/documented hold/);
  });
});

describe("tracking report", () => {
  it("proves who was asked, reminded, opted out or posted, and flags anyone overdue", async () => {
    const db = createMemoryDb();
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      await addClient(db, { id });
      await sign(db, id);
    }
    await addClient(db, { id: "g", segments: ["widowed"] });
    await sign(db, "g");
    const enr = async (id: string) => (await db.enrollments.list((e) => e.leadId === id && e.sequenceId === "review_request"))[0];
    await markSent(db, (await enr("a")).id, "rr_email_t14", plus(14));
    await markSent(db, (await enr("b")).id, "rr_email_t14", plus(14));
    await markSent(db, (await enr("b")).id, "rr_reminder_sms_t21", plus(21));
    await markSent(db, (await enr("c")).id, "rr_email_t14", plus(14));
    await handleReviewReply(db, { leadId: "c", channel: "sms", text: "STOP", at: plus(15) });
    await markSent(db, (await enr("d")).id, "rr_email_t14", plus(14));
    await markReviewPosted(db, admin, "d", plus(16));
    // e: never sent and past T+16: overdue. f: not sent but still inside the window earlier than that.
    const r = await reviewTrackingReport(db, admin, plus(17));
    const status = Object.fromEntries(r.rows.map((x) => [x.matterId, x.status]));
    expect(status).toEqual({ a: "asked", b: "reminded", c: "opted_out", d: "posted", e: "overdue", f: "overdue", g: "excluded" });
    expect(r.totals).toMatchObject({ tracked: 7, eligible: 6, excluded: 1, asked: 4, reminded: 1, optedOut: 1, posted: 1, overdue: 2 });
    expect(r.everyEligibleAsked).toBe(false);
    // Before the due date nobody is overdue.
    const early = await reviewTrackingReport(db, admin, plus(10));
    expect(early.totals.overdue).toBe(0);
    expect(early.rows.find((x) => x.matterId === "e")!.status).toBe("pending");
    // Once the rest are asked, the report says so.
    await markSent(db, (await enr("e")).id, "rr_email_t14", plus(17));
    await markSent(db, (await enr("f")).id, "rr_email_t14", plus(17));
    const ok = await reviewTrackingReport(db, admin, plus(18));
    expect(ok.everyEligibleAsked).toBe(true);
    expect(ok.exclusionsByCode).toEqual({ SENSITIVE_TRACK: 1 });
  });

  it("flags a signed matter with no tracking row instead of hiding it", async () => {
    const db = createMemoryDb();
    await addClient(db, { id: "old", signedAt: plus(-90) });
    const r = await reviewTrackingReport(db, admin, T0);
    expect(r.untracked).toEqual(["old"]);
    expect(r.everyEligibleAsked).toBe(false);
  });

  it("holds matter ids only, no names or contact details", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    expect(JSON.stringify(await reviewTrackingReport(db, admin, plus(1)))).not.toMatch(/Dana|Lee|example\.com|5125550/);
  });

  it("is limited to platform and firm admins, and a firm admin sees only their firm", async () => {
    const db = createMemoryDb();
    await addClient(db, { id: "mine", firmId: "firm-demo" });
    await addClient(db, { id: "theirs", firmId: "other-firm" });
    await sign(db, "mine");
    await sign(db, "theirs");
    expect((await reviewTrackingReport(db, firmAdmin, plus(1))).rows.map((r) => r.matterId)).toEqual(["mine"]);
    expect((await reviewTrackingReport(db, admin, plus(1))).rows).toHaveLength(2);
    await expect(reviewTrackingReport(db, intake)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(reviewTrackingReport(db, marketing)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("sync and the automation runner", () => {
  it("starts requests for recently signed matters the stage hook missed, and leaves old ones untracked", async () => {
    const db = createMemoryDb();
    await addClient(db, { id: "recent", signedAt: plus(-5) });
    await addClient(db, { id: "old", signedAt: plus(-90) });
    const r = await syncReviewRequests(db, T0);
    expect(r.started).toEqual(["recent"]);
    expect((await db.reviewRequests.get("review-recent"))!.anchorAt).toBe(plus(-5).toISOString());
    expect(await db.reviewRequests.get("review-old")).toBeUndefined();
    expect((await syncReviewRequests(db, T0)).started).toEqual([]);
    // T+14 from the real signing date is already ahead of now+9 days.
    expect(await dueIds(db, plus(9))).toEqual(["rr_email_t14"]);
  });

  it("copies a STOP onto the tracking row so admins who cannot read suppressions still see it", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    await applyOptOut(db, { channel: "sms", address: "5125550101", text: "stop", at: plus(2) });
    expect((await syncReviewRequests(db, plus(3))).optedOut).toEqual(["l1"]);
    expect((await db.reviewRequests.get("review-l1"))!.optedOutAt).toBeDefined();
    expect((await db.enrollments.list((e) => e.sequenceId === "review_request"))[0].status).toBe("stopped");
  });

  it("runAutomations starts the request when a lead reaches plan_complete", async () => {
    const db = createMemoryDb();
    await addClient(db);
    // The lead already sits at plan_complete; the runner's sweep picks up the matter even without a stage event.
    const r = await runAutomations(db, null, T0);
    expect(r.reviewRequestsStarted).toBe(1);
    expect(await db.reviewRequests.get("review-l1")).toMatchObject({ eligible: true });
    expect((await runAutomations(db, null, T0)).reviewRequestsStarted).toBe(0);
  });

  it("enrolling twice never double-asks", async () => {
    const db = createMemoryDb();
    await addClient(db);
    await sign(db);
    await sign(db);
    await enroll(db, "l1", "review_request", T0);
    expect((await db.enrollments.list((e) => e.sequenceId === "review_request")).length).toBe(1);
    expect(await db.reviewRequests.list()).toHaveLength(1);
  });
});
