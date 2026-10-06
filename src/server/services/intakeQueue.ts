/**
 * The intake team's work queue and the SLA alerts that keep it honest.
 * Queue items carry no contact details; the case view has those and audits
 * every open.
 */
import { randomUUID } from "node:crypto";
import { audit } from "@/server/audit/log";
import { assertCan, can, requireMfa } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import type { Notifier } from "@/server/notify";
import { MATTER_LABELS } from "@/server/services/leads";
import type { Actor, Lead } from "@/server/types";

export const SPEED_TO_LEAD_MINUTES = 5;
const OFFER_WARN_MINUTES = 10;
const URGENT_ACCEPT_MINUTES = 15;
const ENGAGEMENT_UNSIGNED_HOURS = 72;
const QUEUE_STAGES = ["new", "contacted", "qualified", "conflict_check"];
const MIN = 60_000;

export type SlaStatus = "ok" | "due_soon" | "breached";

export interface QueueItem {
  leadId: string;
  kind: "lead" | "call_task";
  taskId?: string;
  matter: string;
  state: string;
  urgent: boolean;
  minutesWaiting: number;
  slaStatus: SlaStatus;
  nextAction: string;
  ownerName: string;
}

const OUTBOUND = ["call", "sms", "email"];

async function firstOutboundAt(db: Db, lead: Lead): Promise<number | null> {
  const created = new Date(lead.createdAt).getTime();
  const times: number[] = (await db.activities.list((a) => a.leadId === lead.id && a.direction === "outbound" && OUTBOUND.includes(a.kind))).map((a) => new Date(a.at).getTime());
  for (const h of lead.stageHistory) if (h.stage === "contacted") times.push(new Date(h.at).getTime());
  const valid = times.filter((t) => t >= created);
  return valid.length ? Math.min(...valid) : null;
}

function nextActionFor(lead: Lead, contacted: boolean): string {
  if (!contacted) return "Call the lead now";
  if (lead.stage === "qualified") return "Run the conflict check";
  if (lead.stage === "conflict_check") return "Finish the conflict check";
  return "Complete the intake call and summary";
}

export async function intakeQueue(db: Db, actor: Actor, now = new Date()): Promise<QueueItem[]> {
  requireMfa(actor);
  assertCan(can(actor, "work_intake_queue"));
  const users = new Map((await db.users.list()).map((u) => [u.id, u.name]));
  const owner = (id?: string) => (id ? (users.get(id) ?? "Unknown") : "Unclaimed");
  const items: (QueueItem & { breached: boolean; createdAt: number })[] = [];

  for (const lead of await db.leads.list((l) => !l.exit && QUEUE_STAGES.includes(l.stage))) {
    // Same visibility as leadAccess: intake sees their own and unclaimed leads.
    if (actor.role === "intake" && lead.intakeOwnerId && lead.intakeOwnerId !== actor.userId) continue;
    const created = new Date(lead.createdAt).getTime();
    const minutesWaiting = Math.max(0, Math.floor((now.getTime() - created) / MIN));
    const contactAt = await firstOutboundAt(db, lead);
    const contacted = contactAt !== null;
    let slaStatus: SlaStatus = "ok";
    if (!contacted) slaStatus = minutesWaiting > SPEED_TO_LEAD_MINUTES ? "breached" : minutesWaiting >= SPEED_TO_LEAD_MINUTES - 2 ? "due_soon" : "ok";
    items.push({
      leadId: lead.id,
      kind: "lead",
      matter: MATTER_LABELS[lead.matterType],
      state: lead.state,
      urgent: lead.urgent,
      minutesWaiting,
      slaStatus,
      nextAction: nextActionFor(lead, contacted),
      ownerName: owner(lead.intakeOwnerId),
      breached: slaStatus === "breached",
      createdAt: created,
    });
  }

  const tasks = await db.tasks.list((t) => !t.doneAt && t.title.startsWith("Call") && (t.ownerId === actor.userId || t.ownerId === "unassigned"));
  for (const t of tasks) {
    const lead = await db.leads.get(t.leadId);
    if (!lead || lead.exit) continue;
    const due = new Date(t.dueAt).getTime();
    const late = Math.floor((now.getTime() - due) / MIN);
    items.push({
      leadId: lead.id,
      kind: "call_task",
      taskId: t.id,
      matter: MATTER_LABELS[lead.matterType],
      state: lead.state,
      urgent: lead.urgent,
      minutesWaiting: Math.max(0, late),
      slaStatus: late > 60 ? "breached" : late >= 0 ? "due_soon" : "ok",
      nextAction: t.title,
      ownerName: owner(t.ownerId === "unassigned" ? undefined : t.ownerId),
      breached: false,
      createdAt: due,
    });
  }

  // Urgent first, then speed-to-lead breaches, then oldest.
  items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || Number(b.breached) - Number(a.breached) || a.createdAt - b.createdAt);
  return items.map(({ breached: _b, createdAt: _c, ...item }) => item);
}

export async function claimLead(db: Db, actor: Actor, leadId: string, now = new Date()): Promise<Lead> {
  requireMfa(actor);
  assertCan(can(actor, "work_intake_queue"));
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error("Lead not found");
  if (lead.intakeOwnerId && lead.intakeOwnerId !== actor.userId) throw new Error("This lead is already claimed by someone else");
  if (lead.intakeOwnerId === actor.userId) return lead;
  const next = await db.leads.update(leadId, { intakeOwnerId: actor.userId });
  await audit(db, actor, { action: "intake.claim", resourceType: "lead", resourceId: leadId, leadId, at: now });
  return next;
}

export interface SlaAlert {
  /** Stable: the same condition on the same record always yields the same key */
  key: string;
  leadId: string;
  kind: "speed_to_lead" | "offer_expiring" | "urgent_unaccepted" | "engagement_unsigned";
  /** User ids to notify; the lead's intake owner, or all intake users when unclaimed */
  to: string[];
  subject: string;
  /** Never contains client names or case facts */
  text: string;
  link: string;
}

export async function slaAlerts(db: Db, now = new Date()): Promise<SlaAlert[]> {
  const alerts: SlaAlert[] = [];
  const users = await db.users.list((u) => u.active);
  const ofRole = (...roles: string[]) => users.filter((u) => roles.includes(u.role)).map((u) => u.id);
  const leads = await db.leads.list((l) => !l.exit);
  const byId = new Map(leads.map((l) => [l.id, l]));

  for (const lead of leads) {
    if (!QUEUE_STAGES.includes(lead.stage)) continue;
    if ((await firstOutboundAt(db, lead)) !== null) continue;
    const waited = Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / MIN);
    if (waited <= SPEED_TO_LEAD_MINUTES) continue;
    alerts.push({
      key: `speed:${lead.id}`,
      leadId: lead.id,
      kind: "speed_to_lead",
      to: lead.intakeOwnerId ? [lead.intakeOwnerId] : ofRole("intake"),
      subject: "A new lead is waiting",
      text: `A new lead has waited ${waited} minutes without a call.`,
      link: "/portal/queue",
    });
  }

  for (const a of await db.assignments.list((x) => x.status === "offered")) {
    const left = Math.floor((new Date(a.expiresAt).getTime() - now.getTime()) / MIN);
    if (left >= OFFER_WARN_MINUTES || left < 0) continue;
    const lawyerUsers = users.filter((u) => u.role === "attorney" && u.lawyerId === a.lawyerId).map((u) => u.id);
    alerts.push({
      key: `offer:${a.id}`,
      leadId: a.leadId,
      kind: "offer_expiring",
      to: lawyerUsers,
      subject: "An offer is about to expire",
      text: `A new case offer has ${Math.max(0, left)} minutes left to answer.`,
      link: `/portal/leads/${a.leadId}`,
    });
  }

  for (const lead of leads) {
    if (!lead.urgent) continue;
    if (lead.assignedLawyerId) continue; // accepted
    const waited = Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / MIN);
    if (waited < URGENT_ACCEPT_MINUTES) continue;
    alerts.push({
      key: `urgent:${lead.id}`,
      leadId: lead.id,
      kind: "urgent_unaccepted",
      to: ofRole("platform_admin"),
      subject: "Urgent lead not accepted: page the on-call attorney",
      text: `An urgent lead has gone ${waited} minutes without an attorney. Page the on-call attorney.`,
      link: `/portal/leads/${lead.id}`,
    });
  }

  for (const e of await db.engagements.list((x) => x.status === "sent")) {
    const sentAt = [...e.history].reverse().find((h) => h.status === "sent")?.at;
    if (!sentAt || !byId.has(e.leadId)) continue;
    const hours = Math.floor((now.getTime() - new Date(sentAt).getTime()) / (60 * MIN));
    if (hours < ENGAGEMENT_UNSIGNED_HOURS) continue;
    alerts.push({
      key: `engagement:${e.id}`,
      leadId: e.leadId,
      kind: "engagement_unsigned",
      to: users.filter((u) => u.role === "attorney" && u.lawyerId === e.lawyerId).map((u) => u.id),
      subject: "An engagement letter is unsigned",
      text: `An engagement letter has been out for ${hours} hours without a signature.`,
      link: `/portal/leads/${e.leadId}`,
    });
  }
  return alerts;
}

const SENT_PREFIX = "sla-alert:";

/** Sends each alert key once. Sent keys live as system Activities on the lead. */
export async function deliverSlaAlerts(db: Db, notifier: Notifier, now = new Date()): Promise<number> {
  const alerts = await slaAlerts(db, now);
  if (!alerts.length) return 0;
  const sent = new Set((await db.activities.list((a) => a.kind === "system" && a.summary.startsWith(SENT_PREFIX))).map((a) => a.summary.slice(SENT_PREFIX.length)));
  const users = new Map((await db.users.list()).map((u) => [u.id, u]));
  let count = 0;
  for (const alert of alerts) {
    if (sent.has(alert.key)) continue;
    for (const id of alert.to) {
      const u = users.get(id);
      if (!u) continue;
      await notifier.send({ userId: u.id, email: u.email }, { subject: alert.subject, text: alert.text, link: alert.link });
    }
    await db.activities.insert({ id: randomUUID(), leadId: alert.leadId, kind: "system", at: now.toISOString(), summary: `${SENT_PREFIX}${alert.key}` });
    sent.add(alert.key);
    count++;
  }
  return count;
}
