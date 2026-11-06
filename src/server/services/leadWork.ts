/**
 * The everyday call work on a lead, as the lead handling playbook runs it
 * (/mnt/project-files/launch/lead-handling-playbook.md):
 *
 * - log every call, voicemail, text and email, so the attempt count and the
 *   speed-to-lead clock are real;
 * - move a lead to "contacted" or "qualified" by hand;
 * - close a lead with a reason (and reopen it if they come back);
 * - book a consult and record whether it was held, missed or cancelled.
 *
 * Each call checks policy.ts for the lead, then writes an audit event.
 */
import { randomUUID } from "node:crypto";
import { audit } from "@/server/audit/log";
import { assertCan, canOnLead, ForbiddenError, requireMfa } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { isHumanOutreach } from "@/server/services/contact";
import { setStage, exitLead } from "@/server/services/leads";
import { STAGES, type Activity, type Actor, type Assignment, type ExitReason, type Lead, type Role, type Stage } from "@/server/types";

/** Staff who work leads. Clients and marketing never log calls or move stages. */
const STAFF: Role[] = ["platform_admin", "intake", "attorney", "paralegal", "firm_admin"];

export const CONTACT_CHANNELS = ["call", "sms", "email"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_RESULTS = ["reached", "voicemail", "no_answer", "wrong_number", "sent", "replied"] as const;
export type ContactResult = (typeof CONTACT_RESULTS)[number];

export const CONTACT_RESULT_LABELS: Record<ContactResult, string> = {
  reached: "Spoke with them",
  voicemail: "Left a voicemail",
  no_answer: "No answer, no voicemail",
  wrong_number: "Wrong or dead number",
  sent: "Sent",
  replied: "They replied",
};

const CHANNEL_LABELS: Record<ContactChannel, string> = { call: "Call", sms: "Text", email: "Email" };

/** Results that mean a real two-way conversation happened. */
const REACHED: ContactResult[] = ["reached", "replied"];

/** Exit reasons a person can pick. "conflict", "declined_by_all" and "referred_out" are set by their own flows. */
export const MANUAL_EXIT_REASONS = ["not_a_fit", "unresponsive", "chose_another_option"] as const satisfies readonly ExitReason[];
export type ManualExitReason = (typeof MANUAL_EXIT_REASONS)[number];

export const EXIT_LABELS: Record<ExitReason, string> = {
  not_a_fit: "Not a fit (outside what we do, or not ready to plan)",
  unresponsive: "Could not reach them",
  chose_another_option: "Chose someone else or do-it-yourself",
  conflict: "Conflict of interest",
  declined_by_all: "No attorney could take it",
  referred_out: "Referred to an outside attorney",
};

/** Stages a person moves by hand. Later stages follow from consults, offers and the retainer. */
export const MANUAL_STAGES = ["contacted", "qualified"] as const satisfies readonly Stage[];
export type ManualStage = (typeof MANUAL_STAGES)[number];

async function load(db: Db, leadId: string): Promise<{ lead: Lead; assignments: Assignment[] }> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  return { lead, assignments: await db.assignments.list((a) => a.leadId === leadId, { leadId }) };
}

function assertStaff(actor: Actor) {
  requireMfa(actor);
  if (!STAFF.includes(actor.role)) throw new ForbiddenError("Only the team can work leads");
}

/** How many times the team has reached out (calls, texts and emails a person sent; automatic nurture does not count). */
export function outreachAttempts(activities: Pick<Activity, "kind" | "direction" | "summary">[]): number {
  return activities.filter(isHumanOutreach).length;
}

export interface ContactInput {
  channel: ContactChannel;
  direction: "outbound" | "inbound";
  result: ContactResult;
  note?: string;
}

export async function logContact(db: Db, actor: Actor, leadId: string, input: ContactInput, now = new Date()): Promise<{ activity: Activity; attempts: number; lead: Lead }> {
  assertStaff(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "comment", lead, assignments, now));
  if (!CONTACT_CHANNELS.includes(input.channel)) throw new Error("Pick call, text or email");
  if (!CONTACT_RESULTS.includes(input.result)) throw new Error("Pick what happened");
  if (input.channel !== "call" && ["voicemail", "no_answer"].includes(input.result)) throw new Error("Voicemail and no answer are for calls");
  if (input.direction === "inbound" && input.result !== "reached" && input.result !== "replied") throw new Error("An incoming call, text or email means they reached you");
  const note = input.note?.trim();
  if (note && note.length > 2000) throw new Error("Keep the note under 2,000 characters");

  const label = CONTACT_RESULT_LABELS[input.result];
  const activity = await db.activities.insert({
    id: randomUUID(),
    leadId,
    kind: input.channel,
    direction: input.direction,
    at: now.toISOString(),
    // Never starts with "nurture-": isHumanOutreach must count it.
    summary: `${CHANNEL_LABELS[input.channel]}: ${label}${note ? `. ${note}` : ""}`,
    byUserId: actor.userId,
  });
  await audit(db, actor, { action: "contact.log", resourceType: "activity", resourceId: activity.id, leadId, detail: { channel: input.channel, direction: input.direction, result: input.result }, at: now });

  let next = lead;
  // An intake person who logs the first call owns the lead from then on.
  if (actor.role === "intake" && !lead.intakeOwnerId) next = await db.leads.update(leadId, { intakeOwnerId: actor.userId });
  if (REACHED.includes(input.result) && lead.stage === "new") next = await setStage(db, actor, leadId, "contacted", now);
  const attempts = outreachAttempts(await db.activities.list((a) => a.leadId === leadId, { leadId }));
  return { activity, attempts, lead: next };
}

export async function moveStage(db: Db, actor: Actor, leadId: string, stage: ManualStage, now = new Date()): Promise<Lead> {
  assertStaff(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "manage_tasks", lead, assignments, now));
  if (!MANUAL_STAGES.includes(stage)) throw new Error("Only contacted and qualified are set by hand");
  if (lead.exit) throw new Error("This lead is closed. Reopen it first");
  if (STAGES.indexOf(stage) <= STAGES.indexOf(lead.stage)) throw new Error(`This lead is already past ${stage}`);
  return await setStage(db, actor, leadId, stage, now);
}

export async function closeLead(db: Db, actor: Actor, leadId: string, reason: ManualExitReason, note?: string, now = new Date()): Promise<Lead> {
  assertStaff(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "manage_tasks", lead, assignments, now));
  if (!MANUAL_EXIT_REASONS.includes(reason)) throw new Error("Pick a reason");
  if (lead.exit) throw new Error("This lead is already closed");
  if (STAGES.indexOf(lead.stage) >= STAGES.indexOf("retainer_signed")) throw new Error("A signed client is not closed here");
  const clean = note?.trim();
  if (clean && clean.length > 1000) throw new Error("Keep the note under 1,000 characters");
  return await exitLead(db, actor, leadId, reason, clean || undefined, now);
}

/** A closed lead who comes back. Conflicts and outside referrals stay closed: those have their own records. */
export async function reopenLead(db: Db, actor: Actor, leadId: string, now = new Date()): Promise<Lead> {
  assertStaff(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "manage_tasks", lead, assignments, now));
  if (!lead.exit) return lead;
  if (!(MANUAL_EXIT_REASONS as readonly string[]).includes(lead.exit.reason)) throw new Error("This lead was closed by a conflict check or a referral and stays closed");
  const next = await db.leads.update(leadId, { exit: undefined });
  await audit(db, actor, { action: "lead.reopen", resourceType: "lead", resourceId: leadId, leadId, detail: { was: lead.exit.reason }, at: now });
  return next;
}

/**
 * A Cal.com booking, reschedule or cancellation. Booked or rescheduled moves the lead to
 * "consult_booked" (as before). Each event is written to the timeline. When an attorney already
 * holds the lead, a booking also adds the consult row so its outcome can be recorded; otherwise a
 * call task goes on the intake queue, because a lead that books first has not had an intake call.
 * A cancellation adds a call task so someone tries to rebook.
 */
export async function recordCalcomBooking(
  db: Db,
  lead: Lead,
  booking: { event: string; startTime?: string },
  now = new Date(),
): Promise<void> {
  const at = now.toISOString();
  const start = booking.startTime;
  const whenText = start ? ` for ${new Date(start).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} Central` : "";
  const due = (start && new Date(start).getTime() > now.getTime() ? new Date(Math.min(new Date(start).getTime() - 60 * 60_000, now.getTime() + 24 * 3_600_000)) : now).toISOString();
  const task = (title: string, dueAt: string) => db.tasks.insert({ id: randomUUID(), leadId: lead.id, title, ownerId: "unassigned", dueAt: dueAt < at ? at : dueAt });

  if (booking.event === "BOOKING_CANCELLED") {
    await db.activities.insert({ id: randomUUID(), leadId: lead.id, kind: "meeting", direction: "inbound", at, summary: `Cancelled the Cal.com consult${whenText}.` });
    for (const c of await db.consults.list((x) => x.leadId === lead.id && x.status === "booked", { leadId: lead.id })) {
      if (!start || c.at === start) await db.consults.update(c.id, { status: "cancelled" });
    }
    if (!lead.exit) await task("Call to rebook the cancelled consult", at);
    await audit(db, "system", { action: "calcom.cancelled", resourceType: "lead", resourceId: lead.id, leadId: lead.id, at: now });
    return;
  }

  const verb = booking.event === "BOOKING_RESCHEDULED" ? "Rescheduled" : "Booked";
  await db.activities.insert({ id: randomUUID(), leadId: lead.id, kind: "meeting", direction: "inbound", at, summary: `${verb} a consult on Cal.com${whenText}.` });
  if (lead.exit) return; // A closed lead who books again: the timeline shows it; staff reopen by hand.
  await setStage(db, "system", lead.id, "consult_booked", now);
  if (lead.assignedLawyerId && start) {
    const existing = await db.consults.list((x) => x.leadId === lead.id && x.status === "booked", { leadId: lead.id });
    if (booking.event === "BOOKING_RESCHEDULED" && existing.length) await db.consults.update(existing[existing.length - 1].id, { at: start });
    else if (!existing.some((c) => c.at === start)) await db.consults.insert({ id: randomUUID(), leadId: lead.id, lawyerId: lead.assignedLawyerId, at: start, type: "phone", status: "booked" });
  } else if (!lead.assignedLawyerId) {
    await task("Call before the booked consult: intake questions and conflict check", due);
  }
  await audit(db, "system", { action: "calcom.booked", resourceType: "lead", resourceId: lead.id, leadId: lead.id, at: now });
}
