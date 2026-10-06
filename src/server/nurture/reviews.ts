/**
 * Review requests (Sequence F2 and F3) and the tracking that proves every eligible client was asked.
 * Source: research/gbp-posts-and-reviews.md section 3 and nurture-sequences.md section 6.
 *
 * Rules built in here:
 * - T+0 is signing (stage plan_complete). The email goes at T+14 and one reminder at T+21 (text where the
 *   client gave SMS consent, email otherwise). After that, nothing. No third ask.
 * - It goes to every client. There is no sentiment input anywhere: not the private check-in, not a complaint.
 *   The only exclusions are the written, rule-based codes in ReviewExclusionCode.
 * - A STOP or any other opt-out, a review opt-out, or a self-reported "I posted" ends it at once.
 * - Families after a death and other sensitive tracks are never asked (a uniform hold the attorney can lift).
 * - Nothing here reads open or click data. "I posted" is only ever set by the client's own word or by staff.
 */
import { audit } from "@/server/audit/log";
import { assertCan, can, ForbiddenError } from "@/server/auth/policy";
import { SENSITIVE_SEGMENTS } from "@/server/crm/adapter";
import type { Db } from "@/server/db";
import { applyOptOut, classifyOptOut, normalizeAddress } from "@/server/nurture/compliance";
import { enroll, isGriefLead } from "@/server/nurture/scheduler";
import { getSequence } from "@/server/nurture/sequences";
import type { Actor, Lead, Person, ReviewExclusionCode, ReviewRequest } from "@/server/types";

const DAY = 86_400_000;
export const REVIEW_SEQUENCE_ID = "review_request";
export const REVIEW_POSTED_TAG = "review_posted";
/** How long after T+14 a missing request is called overdue in the report (covers quiet hours and frequency caps). */
export const REVIEW_GRACE_DAYS = 2;
/** The backfill only starts requests for matters signed within this many days; older ones are reported as untracked for a decision. */
export const REVIEW_BACKFILL_DAYS = 30;

export const reviewRowId = (leadId: string) => `review-${leadId}`;

// ---------- Eligibility (written, rule-based, identical for everyone) ----------

/** Matter types and segments where a review ask is held for everyone alike. Never sentiment. */
export function reviewHoldFor(lead: Pick<Lead, "segments" | "matterType" | "capture">): { code: ReviewExclusionCode; note: string } | undefined {
  // Estate administration: the attorney decides one uniform timing rule for all probate clients (spec 3.2). Held until then.
  if (isGriefLead(lead)) return { code: "UNIFORM_HOLD", note: "estate administration: uniform hold until the attorney sets a timing rule" };
  if (lead.segments.some((s) => SENSITIVE_SEGMENTS.includes(s)) || ["special_needs", "elder_law"].includes(lead.matterType)) {
    return { code: "SENSITIVE_TRACK", note: "sensitive track: never asked" };
  }
  return undefined;
}

/** True when the person has opted out in a way that covers review requests: any email or text opt-out, or "all". */
export async function hasReviewOptOut(db: Db, person: Pick<Person, "email" | "phone">): Promise<boolean> {
  const keys = [
    `email:${normalizeAddress("email", person.email)}`,
    `sms:${normalizeAddress("sms", person.phone)}`,
    `all:${normalizeAddress("all", person.email)}`,
    `all:${normalizeAddress("all", person.phone)}`,
  ];
  for (const k of keys) if (await db.suppressions.get(k)) return true;
  return false;
}

// ---------- Start ----------

/**
 * Called when a matter is signed (stage plan_complete). Writes the tracking row and enrolls the client in
 * review_request, or records the rule-based reason they are excluded. Idempotent.
 */
export async function startReviewRequest(db: Db, leadId: string, at: Date): Promise<ReviewRequest | undefined> {
  const existing = await db.reviewRequests.get(reviewRowId(leadId));
  if (existing) return existing;
  const lead = await db.leads.get(leadId);
  if (!lead) return undefined;
  const person = await db.persons.get(lead.personId);
  const hold = reviewHoldFor(lead);
  const optedOut = person ? await hasReviewOptOut(db, person) : false;
  const excluded = hold ?? (optedOut ? { code: "OPTOUT" as const, note: "opted out before the request" } : undefined);
  const row = await db.reviewRequests.insert({
    id: reviewRowId(leadId),
    leadId,
    matterType: lead.matterType,
    anchorAt: at.toISOString(),
    eligible: !excluded,
    ...(excluded ? { exclusionCode: excluded.code, exclusionNote: excluded.note } : {}),
    ...(optedOut && !hold ? { optedOutAt: at.toISOString() } : {}),
    createdAt: at.toISOString(),
  });
  await audit(db, "system", {
    action: excluded ? "review.excluded" : "review.tracked",
    resourceType: "review_request",
    resourceId: row.id,
    leadId,
    detail: excluded ? { code: excluded.code } : { matterType: lead.matterType },
    at,
  });
  if (!excluded) await enroll(db, leadId, REVIEW_SEQUENCE_ID, at);
  return row;
}

/**
 * Daily reconcile, run from the automation runner. (1) Starts review requests for matters that reached plan_complete
 * without a tracking row (signed before this ran, or a missed event), but only recent ones: older matters show as
 * untracked in the report for the attorney to decide. (2) Copies opt-outs recorded as suppressions (a STOP reply)
 * onto the tracking rows, so the report stays right for admins who cannot read suppressions.
 */
export async function syncReviewRequests(db: Db, now: Date): Promise<{ started: string[]; optedOut: string[] }> {
  const started: string[] = [];
  const optedOut: string[] = [];
  const tracked = new Map((await db.reviewRequests.list()).map((r) => [r.leadId, r]));
  for (const lead of await db.leads.list()) {
    const row = tracked.get(lead.id);
    if (!row) {
      const signedAt = signedAtOf(lead);
      if (!signedAt || now.getTime() - Date.parse(signedAt) > REVIEW_BACKFILL_DAYS * DAY) continue;
      await startReviewRequest(db, lead.id, new Date(signedAt));
      started.push(lead.id);
    } else if (!row.optedOutAt && !row.postedAt && now.getTime() - Date.parse(row.anchorAt) < 40 * DAY) {
      const person = await db.persons.get(lead.personId);
      if (person && (await hasReviewOptOut(db, person))) {
        await recordReviewStop(db, lead.id, "opted_out", now);
        await stopReviewEnrollment(db, lead.id, "opted_out", now);
        optedOut.push(lead.id);
      }
    }
  }
  return { started, optedOut };
}

export const signedAtOf = (lead: Pick<Lead, "stageHistory">): string | undefined =>
  lead.stageHistory.filter((h) => h.stage === "plan_complete").map((h) => h.at).sort()[0];

// ---------- Send-time guard and recording (called by the scheduler) ----------

/**
 * Why this client's review request must stop now, or undefined to keep going. Checked on every poll, so a STOP,
 * an "I posted" or a new sensitive tag between T+14 and T+21 is honoured before the reminder.
 */
export async function reviewStopReason(db: Db, lead: Lead, person: Person): Promise<"posted" | "opted_out" | "sensitive_track" | undefined> {
  const row = await db.reviewRequests.get(reviewRowId(lead.id));
  if (row?.postedAt || lead.segments.includes(REVIEW_POSTED_TAG)) return "posted";
  if (row?.optedOutAt || (await hasReviewOptOut(db, person))) return "opted_out";
  if (reviewHoldFor(lead)) return "sensitive_track";
  return undefined;
}

/** Records on the tracking row why an enrollment stopped, so the report shows it. */
export async function recordReviewStop(db: Db, leadId: string, reason: "posted" | "opted_out" | "sensitive_track", at: Date): Promise<void> {
  const row = await db.reviewRequests.get(reviewRowId(leadId));
  if (!row) return;
  if (reason === "opted_out" && !row.optedOutAt) {
    await db.reviewRequests.update(row.id, { optedOutAt: at.toISOString() });
    await audit(db, "system", { action: "review.opted_out", resourceType: "review_request", resourceId: row.id, leadId, detail: { source: "suppression" }, at });
  }
  if (reason === "posted" && !row.postedAt) {
    await db.reviewRequests.update(row.id, { postedAt: at.toISOString() });
    await audit(db, "system", { action: "review.posted", resourceType: "review_request", resourceId: row.id, leadId, detail: { source: "tag" }, at });
  }
}

/** The sender reported a review step as delivered. */
export async function recordReviewSend(db: Db, leadId: string, stepId: string, channel: "email" | "sms", at: Date): Promise<void> {
  const row = await db.reviewRequests.get(reviewRowId(leadId));
  if (!row) return;
  const first = stepId.startsWith("rr_email");
  if (first ? row.askedAt : row.remindedAt) return;
  await db.reviewRequests.update(row.id, first ? { askedAt: at.toISOString() } : { remindedAt: at.toISOString(), reminderChannel: channel });
  await audit(db, "system", {
    action: first ? "review.asked" : "review.reminded",
    resourceType: "review_request",
    resourceId: row.id,
    leadId,
    detail: { stepId, channel },
    at,
  });
}

// ---------- Client and staff actions ----------

async function stopReviewEnrollment(db: Db, leadId: string, reason: string, at: Date): Promise<void> {
  for (const e of await db.enrollments.list((x) => x.leadId === leadId && x.sequenceId === REVIEW_SEQUENCE_ID && x.status === "active")) {
    await db.enrollments.update(e.id, { status: "stopped", stoppedReason: reason });
    await audit(db, "system", { action: "nurture.enrollment_stopped", resourceType: "enrollment", resourceId: e.id, leadId, detail: { sequenceId: e.sequenceId, reason }, at });
  }
}

async function rowFor(db: Db, leadId: string): Promise<ReviewRequest> {
  const row = await db.reviewRequests.get(reviewRowId(leadId));
  if (!row) throw new Error("No review request is tracked for this matter");
  return row;
}

function assertStaffMayTouch(actor: Actor | "system", lead: Lead): void {
  if (actor === "system") return;
  assertCan(can(actor, "manage_reviews"));
  if (actor.role === "firm_admin" && actor.firmId !== lead.firmId) throw new ForbiddenError();
}

/**
 * The client said they posted (or staff recorded it at their word). Tags the lead, stops the reminder and records
 * it. Never inferred from anything else. Idempotent.
 */
export async function markReviewPosted(db: Db, actor: Actor | "system", leadId: string, at: Date, source: "client_reply" | "staff" = "staff"): Promise<ReviewRequest> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  assertStaffMayTouch(actor, lead);
  const row = await rowFor(db, leadId);
  if (row.postedAt) return row;
  if (!lead.segments.includes(REVIEW_POSTED_TAG)) await db.leads.update(leadId, { segments: [...lead.segments, REVIEW_POSTED_TAG] });
  const next = await db.reviewRequests.update(row.id, { postedAt: at.toISOString() });
  await stopReviewEnrollment(db, leadId, "posted", at);
  await audit(db, actor, { action: "review.posted", resourceType: "review_request", resourceId: row.id, leadId, detail: { source }, at });
  return next;
}

/** "Do not ask me about reviews" from the client (preferences or a reply). Never asked again by any channel. Idempotent. */
export async function optOutOfReviews(db: Db, actor: Actor | "system", leadId: string, at: Date, source: "client_reply" | "preferences" | "staff" = "staff"): Promise<ReviewRequest> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  assertStaffMayTouch(actor, lead);
  const row = await rowFor(db, leadId);
  if (row.optedOutAt) return row;
  const next = await db.reviewRequests.update(row.id, { optedOutAt: at.toISOString() });
  await stopReviewEnrollment(db, leadId, "opted_out", at);
  await audit(db, actor, { action: "review.opted_out", resourceType: "review_request", resourceId: row.id, leadId, detail: { source }, at });
  return next;
}

/** Phrases for a reply that means "I already posted". Whole-message intent only, and a negation never counts. */
export function isPostedReply(text: string): boolean {
  const t = text.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t || t.length > 120) return false;
  if (/\b(not|n't|never|haven't|havent|didn't|didnt|won't|wont|will|going to|gonna|plan to|planning to|about to|later)\b/.test(t)) return false;
  return /\b(i )?(already |just )?(posted|reviewed)\b|\b(i )?(left|wrote|submitted|did|gave|put up) (you |a |my |the |one |it )?(a )?(review|it)\b|\bdone\b$/.test(t) || /^(done|posted|i posted)$/.test(t);
}

/**
 * Handles an inbound reply to a review message. STOP and its variants go through the shared opt-out path (and
 * stop review requests on every channel); "I posted" tags the lead; anything else is left for a person.
 */
export async function handleReviewReply(
  db: Db,
  input: { leadId: string; channel: "sms" | "email"; text: string; at: Date },
): Promise<"opted_out" | "posted" | "none"> {
  const lead = await db.leads.get(input.leadId);
  const person = lead ? await db.persons.get(lead.personId) : undefined;
  if (!lead || !person) return "none";
  const address = input.channel === "sms" ? person.phone : person.email;
  if (classifyOptOut(input.text).optOut) {
    await applyOptOut(db, { channel: input.channel, address, text: input.text, at: input.at });
    if (await db.reviewRequests.get(reviewRowId(lead.id))) await optOutOfReviews(db, "system", lead.id, input.at, "client_reply");
    return "opted_out";
  }
  if (isPostedReply(input.text) && (await db.reviewRequests.get(reviewRowId(lead.id)))) {
    await markReviewPosted(db, "system", lead.id, input.at, "client_reply");
    return "posted";
  }
  return "none";
}

/**
 * The attorney's written, documented holds (GUARDIANSHIP or DISPUTE_HOLD), set before a request goes out.
 * A hold needs a note, is logged, and for a dispute is lifted by `releaseReviewHold` (the request then sends).
 * A hold is never a way to skip someone for what they said; the report lists every one.
 */
export async function holdReview(db: Db, actor: Actor, leadId: string, code: "GUARDIANSHIP" | "DISPUTE_HOLD", note: string, at: Date): Promise<ReviewRequest> {
  if (actor.role !== "platform_admin" && actor.role !== "firm_admin") throw new ForbiddenError("The attorney's office decides review holds");
  if (!note.trim()) throw new Error("A review hold needs a written reason");
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  assertStaffMayTouch(actor, lead);
  const row = await rowFor(db, leadId);
  if (row.askedAt) throw new Error("This client was already asked");
  const next = await db.reviewRequests.update(row.id, { eligible: false, exclusionCode: code, exclusionNote: note.trim().slice(0, 300) });
  await stopReviewEnrollment(db, leadId, `hold:${code}`, at);
  await audit(db, actor, { action: "review.hold", resourceType: "review_request", resourceId: row.id, leadId, detail: { code }, at });
  return next;
}

/** Lifts a DISPUTE_HOLD or GUARDIANSHIP hold: the client is asked as soon as it is safe, on the normal T+14 and T+21 gap. */
export async function releaseReviewHold(db: Db, actor: Actor, leadId: string, at: Date): Promise<ReviewRequest> {
  if (actor.role !== "platform_admin" && actor.role !== "firm_admin") throw new ForbiddenError("The attorney's office decides review holds");
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  assertStaffMayTouch(actor, lead);
  const row = await rowFor(db, leadId);
  if (!["GUARDIANSHIP", "DISPUTE_HOLD"].includes(row.exclusionCode ?? "")) throw new Error("Only a documented hold can be released");
  const next = await db.reviewRequests.update(row.id, { eligible: true, exclusionCode: undefined, exclusionNote: undefined });
  await audit(db, actor, { action: "review.hold_released", resourceType: "review_request", resourceId: row.id, leadId, detail: {}, at });
  // Start the clock so the email is due now (T+14 from a shifted start) and the reminder a week later.
  const seq = getSequence(REVIEW_SEQUENCE_ID);
  const emailDays = seq?.steps.find((s) => s.id === "rr_email_t14")?.offset.days ?? 14;
  await enroll(db, leadId, REVIEW_SEQUENCE_ID, new Date(at.getTime() - emailDays * DAY));
  return next;
}

// ---------- Report: proof that every eligible client was asked ----------

export type ReviewStatus = "posted" | "opted_out" | "reminded" | "asked" | "pending" | "overdue" | "excluded";

export interface ReviewReportRow {
  matterId: string;
  matterType: string;
  anchorAt: string;
  eligible: boolean;
  exclusionCode?: ReviewExclusionCode;
  exclusionNote?: string;
  askedAt?: string;
  remindedAt?: string;
  reminderChannel?: "sms" | "email";
  optedOutAt?: string;
  postedAt?: string;
  status: ReviewStatus;
}

export interface ReviewReport {
  generatedAt: string;
  firmId?: string;
  totals: { tracked: number; eligible: number; excluded: number; asked: number; reminded: number; optedOut: number; posted: number; pending: number; overdue: number };
  /** Every exclusion by code. Anything outside the written rule set would show here. */
  exclusionsByCode: Record<string, number>;
  /** Matters that reached plan_complete with no tracking row. Each is a gap in the proof that needs a decision. */
  untracked: string[];
  /** True only when every eligible client has been asked on schedule and nothing is untracked. */
  everyEligibleAsked: boolean;
  rows: ReviewReportRow[];
}

export async function reviewTrackingReport(db: Db, actor: Actor, now = new Date()): Promise<ReviewReport> {
  assertCan(can(actor, "view_review_tracking"));
  let firmId: string | undefined;
  if (actor.role === "firm_admin") {
    if (!actor.firmId) throw new ForbiddenError();
    firmId = actor.firmId;
  }
  const leads = await db.leads.list(undefined, firmId ? { firmId } : undefined);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const rows = (await db.reviewRequests.list((r) => leadById.has(r.leadId))).sort((a, b) => a.anchorAt.localeCompare(b.anchorAt));
  const out: ReviewReportRow[] = [];
  for (const r of rows) {
    const lead = leadById.get(r.leadId)!;
    const person = await db.persons.get(lead.personId);
    // Opt-outs recorded as suppressions (a STOP) count even before the sweep wrote them to the row.
    const optedOutAt = r.optedOutAt ?? ((person && (await hasReviewOptOut(db, person))) ? (await suppressionTime(db, person)) : undefined);
    const postedAt = r.postedAt ?? (lead.segments.includes(REVIEW_POSTED_TAG) ? r.createdAt : undefined);
    const overdue = r.eligible && !r.askedAt && !optedOutAt && !postedAt && now.getTime() > Date.parse(r.anchorAt) + (14 + REVIEW_GRACE_DAYS) * DAY;
    const status: ReviewStatus = postedAt ? "posted" : optedOutAt ? "opted_out" : !r.eligible ? "excluded" : r.remindedAt ? "reminded" : r.askedAt ? "asked" : overdue ? "overdue" : "pending";
    out.push({
      matterId: r.leadId, matterType: r.matterType, anchorAt: r.anchorAt, eligible: r.eligible, exclusionCode: r.exclusionCode, exclusionNote: r.exclusionNote,
      askedAt: r.askedAt, remindedAt: r.remindedAt, reminderChannel: r.reminderChannel, optedOutAt, postedAt, status,
    });
  }
  const tracked = new Set(rows.map((r) => r.leadId));
  const untracked = leads.filter((l) => signedAtOf(l) && !tracked.has(l.id)).map((l) => l.id);
  const count = (s: ReviewStatus) => out.filter((r) => r.status === s).length;
  const exclusionsByCode: Record<string, number> = {};
  for (const r of out) if (r.exclusionCode) exclusionsByCode[r.exclusionCode] = (exclusionsByCode[r.exclusionCode] ?? 0) + 1;
  const overdue = count("overdue");
  return {
    generatedAt: now.toISOString(),
    firmId,
    totals: {
      tracked: out.length,
      eligible: out.filter((r) => r.eligible).length,
      excluded: out.filter((r) => !r.eligible).length,
      asked: out.filter((r) => r.askedAt).length,
      reminded: out.filter((r) => r.remindedAt).length,
      optedOut: out.filter((r) => r.optedOutAt).length,
      posted: out.filter((r) => r.postedAt).length,
      pending: count("pending"),
      overdue,
    },
    exclusionsByCode,
    untracked,
    everyEligibleAsked: overdue === 0 && untracked.length === 0,
    rows: out,
  };
}

async function suppressionTime(db: Db, person: Pick<Person, "email" | "phone">): Promise<string | undefined> {
  const keys = [
    `email:${normalizeAddress("email", person.email)}`,
    `sms:${normalizeAddress("sms", person.phone)}`,
    `all:${normalizeAddress("all", person.email)}`,
    `all:${normalizeAddress("all", person.phone)}`,
  ];
  for (const k of keys) {
    const s = await db.suppressions.get(k);
    if (s) return s.at;
  }
  return undefined;
}
