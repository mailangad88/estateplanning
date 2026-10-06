/**
 * Nurture scheduler. Enrollments are plain rows; `dueSends` is a pure-ish poll
 * that a cron calls and a sender consumes, then reports back with `markSent`.
 * All compliance guards run here, at send time, so a consent change or opt-out
 * between enrollment and send is always honoured.
 */
import type { Db } from "@/server/db";
import { audit } from "@/server/audit/log";
import { STAGES, type ExitReason, type Lead, type Person, type Stage } from "@/server/types";
import type { Channel, SequenceEnrollment } from "@/server/nurture/types";
import {
  LIFE_EVENT_SEGMENTS,
  getSequence,
  lifeEventSequenceId,
  stepOffsetMs,
  type Sequence,
  type SequenceStep,
} from "@/server/nurture/sequences";
import {
  MARKETING_EMAIL_CAP_PER_DAY,
  MARKETING_TEXT_CAPS,
  isSuppressed,
  normalizeAddress,
  nextAllowedSendTime,
  insideSendWindow,
} from "@/server/nurture/compliance";

const DAY = 86_400_000;
const stageIdx = (s: Stage) => STAGES.indexOf(s);

export interface SchedulerCtx {
  /** ISO time of the lead's upcoming consult, for consult-anchored steps. */
  consultAt?: (leadId: string) => string | undefined;
}

export interface DueSend {
  enrollmentId: string;
  leadId: string;
  stepId: string;
  channel: Channel;
  sendAt: string;
  templateKey: string;
  brainFileEntryIds: string[];
}

export interface DeferredSend extends DueSend {
  reason: "quiet_hours" | "frequency_cap";
  until: string;
}

const PRE_SALE = [
  "speed_to_lead",
  "quiz_follow_up",
  "grief_support",
  "magnet_follow_up",
  ...LIFE_EVENT_SEGMENTS.map(lifeEventSequenceId),
  "consult_booked",
  "no_show_recovery",
  "consult_held_not_signed",
  "long_term",
];

// ---------- Enrollment ----------

function stop(db: Db, enr: SequenceEnrollment, reason: string, at: Date): void {
  db.enrollments.update(enr.id, { status: "stopped", stoppedReason: reason });
  audit(db, "system", {
    action: "nurture.enrollment_stopped",
    resourceType: "enrollment",
    resourceId: enr.id,
    leadId: enr.leadId,
    detail: { sequenceId: enr.sequenceId, reason },
    at,
  });
}

function stopActive(db: Db, leadId: string, sequenceIds: string[], reason: string, at: Date): void {
  for (const e of db.enrollments.list((e) => e.leadId === leadId && e.status === "active" && sequenceIds.includes(e.sequenceId))) {
    stop(db, e, reason, at);
  }
}

/** Idempotent while an enrollment for the same lead and sequence is active. `at` may be in the future to delay a start. */
export function enroll(db: Db, leadId: string, sequenceId: string, at: Date): SequenceEnrollment {
  if (!getSequence(sequenceId)) throw new Error(`unknown sequence ${sequenceId}`);
  const mine = db.enrollments.list((e) => e.leadId === leadId && e.sequenceId === sequenceId);
  const active = mine.find((e) => e.status === "active");
  if (active) return active;
  const enr = db.enrollments.insert({
    id: `enr-${leadId}-${sequenceId}-${mine.length + 1}`,
    leadId,
    sequenceId,
    enrolledAt: at.toISOString(),
    status: "active",
    sentStepIds: [],
  });
  audit(db, "system", { action: "nurture.enrolled", resourceType: "enrollment", resourceId: enr.id, leadId, detail: { sequenceId }, at });
  return enr;
}

/** Guides that go to grieving families. Their downloads route to grief_support, never to marketing. */
export const GRIEF_RESOURCES = ["after-a-death-checklist", "executor-first-30-days-guide", "what_to_do_when_someone_dies"];

/**
 * True for estate administration leads: the segment tag, an after-a-death guide,
 * or a tool used in heir mode (probate and executor calculators).
 */
export function isGriefLead(lead: Pick<Lead, "segments" | "matterType" | "capture">): boolean {
  if (lead.matterType === "administration" || lead.segments.some((s) => ["estate_administration", "heir_probate", "executor_or_heir"].includes(s))) return true;
  if (lead.capture?.resource && GRIEF_RESOURCES.includes(lead.capture.resource)) return true;
  return lead.capture?.result?.mode === "heir";
}

/**
 * New lead: speed_to_lead at once, quiz_follow_up when quiz answers exist, and one
 * life-event track per matching segment. Life-event tracks start 3 days out and
 * are staggered 2 days apart so a lead with several tags is not flooded.
 */
export function enrollForNewLead(db: Db, lead: Lead, at: Date): SequenceEnrollment[] {
  // Families handling an estate get only the gentle track: no speed-to-lead texts, no marketing.
  if (isGriefLead(lead)) return [enroll(db, lead.id, "grief_support", at)];
  const out = [enroll(db, lead.id, "speed_to_lead", at)];
  if (Object.keys(lead.intake?.answers ?? {}).length > 0) out.push(enroll(db, lead.id, "quiz_follow_up", at));
  if (lead.segments.some((s) => s.startsWith("resource:"))) out.push(enroll(db, lead.id, "magnet_follow_up", at));
  const tracks = LIFE_EVENT_SEGMENTS.filter((s) => lead.segments.includes(s));
  tracks.forEach((seg, i) => out.push(enroll(db, lead.id, lifeEventSequenceId(seg), new Date(at.getTime() + (3 + 2 * i) * DAY))));
  return out;
}

// ---------- Due sends ----------

function exitReason(db: Db, seq: Sequence, lead: Lead, person: Person | undefined): string | undefined {
  for (const c of seq.exitWhen) {
    if (c.kind === "stage_reached" && stageIdx(lead.stage) >= stageIdx(c.stage)) return `stage_reached:${c.stage}`;
    if (c.kind === "exit_set" && lead.exit) return `exit_set:${lead.exit.reason}`;
    if (c.kind === "unsubscribed" && person) {
      const hit = [person.phone, person.email].some((a) => isSuppressedAll(db, a));
      if (hit) return "unsubscribed";
    }
  }
  return undefined;
}

function isSuppressedAll(db: Db, address: string): boolean {
  return db.suppressions.get(`all:${normalizeAddress("all", address)}`) !== undefined;
}

function skip(db: Db, enr: SequenceEnrollment, stepId: string, reason: string, at: Date): SequenceEnrollment {
  const next = db.enrollments.update(enr.id, {
    sentStepIds: [...enr.sentStepIds, stepId],
    skipped: [...(enr.skipped ?? []), { stepId, reason, at: at.toISOString() }],
  });
  audit(db, "system", {
    action: "nurture.step_skipped",
    resourceType: "enrollment",
    resourceId: enr.id,
    leadId: enr.leadId,
    detail: { stepId, reason },
    at,
  });
  return next;
}

function personLeadIds(db: Db, personId: string): Set<string> {
  return new Set(db.leads.list((l) => l.personId === personId).map((l) => l.id));
}

function maybeComplete(db: Db, enr: SequenceEnrollment, seq: Sequence, at: Date): void {
  if (enr.status !== "active" || !seq.steps.every((s) => enr.sentStepIds.includes(s.id))) return;
  db.enrollments.update(enr.id, { status: "completed" });
  audit(db, "system", { action: "nurture.enrollment_completed", resourceType: "enrollment", resourceId: enr.id, leadId: enr.leadId, detail: { sequenceId: seq.id }, at });
  // consult_held_not_signed ends with "then monthly", which is the long_term track.
  if (seq.id === "consult_held_not_signed") {
    const lead = db.leads.get(enr.leadId);
    if (lead && stageIdx(lead.stage) < stageIdx("retainer_signed") && !lead.exit && !isGriefLead(lead)) enroll(db, enr.leadId, "long_term", at);
  }
}

export interface Evaluation {
  due: DueSend[];
  deferred: DeferredSend[];
}

/**
 * Evaluates every active enrollment at `now`. Side effects: enrollments that hit an
 * exit condition are stopped, and steps that can never be sent (no SMS consent,
 * suppressed, wrong segment, consult window already passed) are recorded as skipped.
 * Steps blocked only by timing (quiet hours, frequency caps) are deferred: left
 * unsent and reported, never skipped.
 */
export function evaluateSends(db: Db, now: Date, ctx: SchedulerCtx = {}): Evaluation {
  const due: DueSend[] = [];
  const deferred: DeferredSend[] = [];
  const batchCount = new Map<string, number>(); // `${personId}:${channel}` sends already due this batch

  for (const listed of db.enrollments.list((e) => e.status === "active").sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt))) {
    let enr = listed;
    const seq = getSequence(enr.sequenceId);
    const lead = db.leads.get(enr.leadId);
    if (!seq || !lead) continue;
    const person = db.persons.get(lead.personId);
    if (!person) {
      stop(db, enr, "person_missing", now);
      continue;
    }
    const why = exitReason(db, seq, lead, person);
    if (why) {
      stop(db, enr, `exit:${why}`, now);
      continue;
    }

    const enrolledMs = Date.parse(enr.enrolledAt);
    for (const st of seq.steps) {
      if (enr.sentStepIds.includes(st.id)) continue;
      const sendMs = sendTime(st, enrolledMs, lead.id, ctx);
      if (sendMs === undefined) continue; // anchor not known yet, wait
      if (sendMs > now.getTime()) continue;

      const base: DueSend = {
        enrollmentId: enr.id,
        leadId: lead.id,
        stepId: st.id,
        channel: st.channel,
        sendAt: new Date(sendMs).toISOString(),
        templateKey: st.templateKey,
        brainFileEntryIds: st.brainFileEntryIds,
      };

      const segs = lead.segments;
      if (st.onlySegments && !st.onlySegments.some((s) => segs.includes(s))) { enr = skip(db, enr, st.id, "segment_mismatch", now); continue; }
      if (st.exceptSegments && st.exceptSegments.some((s) => segs.includes(s))) { enr = skip(db, enr, st.id, "segment_mismatch", now); continue; }
      // A reminder whose moment has passed (booked inside the window, or consult already over) is worthless.
      if (st.anchor === "consult" && (sendMs < enrolledMs || now.getTime() > Date.parse(ctx.consultAt?.(lead.id) ?? ""))) {
        enr = skip(db, enr, st.id, "window_passed", now);
        continue;
      }
      if (st.channel === "sms" && lead.consent.smsConsent !== true) { enr = skip(db, enr, st.id, "no_sms_consent", now); continue; }
      if (isSuppressed(db, st.channel, person)) { enr = skip(db, enr, st.id, "suppressed", now); continue; }

      // Call tasks go to a human, so quiet hours and caps do not gate them.
      if (st.channel === "sms" && !insideSendWindow(person.state, now)) {
        deferred.push({ ...base, reason: "quiet_hours", until: nextAllowedSendTime(person.state, now).toISOString() });
        continue;
      }
      if (!st.transactional && (st.channel === "sms" || st.channel === "email")) {
        const cap = st.channel === "sms" ? MARKETING_TEXT_CAPS[person.state.toUpperCase()] : MARKETING_EMAIL_CAP_PER_DAY;
        if (cap !== undefined) {
          const key = `${person.id}:${st.channel}`;
          const recent = recentSends(db, person.id, st.channel, now);
          const inBatch = batchCount.get(key) ?? 0;
          if (recent.length + inBatch >= cap) {
            const oldest = recent.length ? Math.min(...recent) : now.getTime();
            deferred.push({ ...base, reason: "frequency_cap", until: new Date(Math.max(oldest + DAY, now.getTime() + 60_000)).toISOString() });
            continue;
          }
          batchCount.set(key, inBatch + 1);
        }
      }
      due.push(base);
    }
    maybeComplete(db, enr, seq, now);
  }
  return { due, deferred };
}

export function dueSends(db: Db, now: Date, ctx: SchedulerCtx = {}): DueSend[] {
  return evaluateSends(db, now, ctx).due;
}

function sendTime(st: SequenceStep, enrolledMs: number, leadId: string, ctx: SchedulerCtx): number | undefined {
  if (st.anchor === "consult") {
    const c = ctx.consultAt?.(leadId);
    return c ? Date.parse(c) + stepOffsetMs(st.offset) : undefined;
  }
  return enrolledMs + stepOffsetMs(st.offset);
}

/** Epoch ms of this person's non-transactional nurture sends on a channel in the 24h before `now`. */
function recentSends(db: Db, personId: string, channel: "sms" | "email", now: Date): number[] {
  const leadIds = personLeadIds(db, personId);
  const since = now.getTime() - DAY;
  return db.activities
    .list((a) => leadIds.has(a.leadId) && a.kind === channel && a.direction === "outbound" && a.summary.startsWith("nurture-marketing:"))
    .map((a) => Date.parse(a.at))
    .filter((t) => t > since);
}

// ---------- Recording sends ----------

/** Called by the sender after delivery (or after a call task is created). Idempotent per step. */
export function markSent(db: Db, enrollmentId: string, stepId: string, at: Date): SequenceEnrollment {
  const enr = db.enrollments.get(enrollmentId);
  if (!enr) throw new Error(`enrollment not found: ${enrollmentId}`);
  const seq = getSequence(enr.sequenceId);
  const st = seq?.steps.find((s) => s.id === stepId);
  if (!seq || !st) throw new Error(`unknown step ${stepId} in ${enr.sequenceId}`);
  if (enr.sentStepIds.includes(stepId)) return enr;

  const lead = db.leads.get(enr.leadId);
  const updated = db.enrollments.update(enr.id, { sentStepIds: [...enr.sentStepIds, stepId] });
  if (lead && st.channel !== "call_task") {
    // The summary prefix is what the frequency caps count; transactional sends are exempt.
    db.activities.insert({
      id: `act-nurture-${enr.id}-${stepId}`,
      leadId: lead.id,
      kind: st.channel,
      direction: "outbound",
      at: at.toISOString(),
      summary: `${st.transactional ? "nurture-service" : "nurture-marketing"}:${stepId}`,
    });
  }
  if (lead && st.channel === "call_task") {
    db.tasks.insert({
      id: `task-nurture-${enr.id}-${stepId}`,
      leadId: lead.id,
      title: `Call: ${st.purpose}`,
      ownerId: lead.intakeOwnerId ?? "unassigned",
      dueAt: at.toISOString(),
    });
  }
  audit(db, "system", {
    action: "nurture.step_sent",
    resourceType: "enrollment",
    resourceId: enr.id,
    leadId: enr.leadId,
    detail: { stepId, channel: st.channel, templateKey: st.templateKey },
    at,
  });
  maybeComplete(db, updated, seq, at);
  return db.enrollments.get(enr.id)!;
}

// ---------- Hooks ----------

/** Call after the lead's stage has been updated. */
export function onStageChange(db: Db, leadId: string, stage: Stage, at: Date): void {
  switch (stage) {
    case "consult_booked":
      stopActive(db, leadId, PRE_SALE.filter((s) => s !== "consult_booked"), "stage:consult_booked", at);
      enroll(db, leadId, "consult_booked", at);
      break;
    case "consult_held":
      stopActive(db, leadId, ["consult_booked", "no_show_recovery", "long_term"], "stage:consult_held", at);
      enroll(db, leadId, "consult_held_not_signed", at);
      break;
    case "retainer_signed":
      stopActive(db, leadId, PRE_SALE, "stage:retainer_signed", at);
      enroll(db, leadId, "signed_onboarding", at);
      break;
    case "plan_complete":
      stopActive(db, leadId, ["signed_onboarding"], "stage:plan_complete", at);
      enroll(db, leadId, "plan_complete", at);
      enroll(db, leadId, "annual_review", at);
      break;
    default:
      break;
  }
}

/** Consult marked no-show: stop reminders, start recovery. */
export function onConsultNoShow(db: Db, leadId: string, at: Date): void {
  stopActive(db, leadId, ["consult_booked"], "consult_no_show", at);
  enroll(db, leadId, "no_show_recovery", at);
}

/** Lead exited. Only "unresponsive" goes to long_term; not_a_fit, conflict and the rest stop all nurture. */
export function onExit(db: Db, leadId: string, reason: ExitReason, at: Date): void {
  if (reason === "unresponsive") {
    stopActive(db, leadId, PRE_SALE.filter((s) => s !== "long_term"), "exit:unresponsive", at);
    const lead = db.leads.get(leadId);
    if (lead && !isGriefLead(lead)) enroll(db, leadId, "long_term", at);
  } else {
    stopActive(db, leadId, PRE_SALE, `exit:${reason}`, at);
  }
}

/**
 * Daily sweep: pre-consult leads with no active enrollment and no inbound activity or
 * stage change for 60 days move to long_term. Returns the lead ids enrolled.
 */
export function sweepQuietLeads(db: Db, now: Date): string[] {
  const cutoff = now.getTime() - 60 * DAY;
  const out: string[] = [];
  for (const lead of db.leads.list()) {
    if (stageIdx(lead.stage) >= stageIdx("consult_booked")) continue;
    if (lead.exit && lead.exit.reason !== "unresponsive") continue;
    // Grieving families never get the monthly marketing newsletter.
    if (isGriefLead(lead)) continue;
    if (db.enrollments.list((e) => e.leadId === lead.id && e.status === "active").length > 0) continue;
    if (db.enrollments.list((e) => e.leadId === lead.id && e.sequenceId === "long_term").length > 0) continue;
    const last = Math.max(
      Date.parse(lead.createdAt),
      ...lead.stageHistory.map((h) => Date.parse(h.at)),
      ...db.activities.list((a) => a.leadId === lead.id && a.direction === "inbound").map((a) => Date.parse(a.at)),
    );
    if (last > cutoff) continue;
    enroll(db, lead.id, "long_term", now);
    out.push(lead.id);
  }
  return out;
}
