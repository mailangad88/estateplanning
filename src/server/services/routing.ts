/**
 * Routing service: offers a lead to one lawyer at a time, handles accept,
 * decline and timeout, and records every step in the audit log. Ranking logic
 * lives in the pure engine; this file only loads data and writes results.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "@/server/db";
import { audit } from "@/server/audit/log";
import { ForbiddenError } from "@/server/auth/policy";
import { rankLawyers, type RoutingInput } from "@/server/routing/engine";
import type { Actor, Assignment, DeclineReason, Lead } from "@/server/types";

export interface OfferResult {
  offered: Assignment | null;
  nextStep?: "refer_to_bar_referral_service_and_long_term_nurture";
}

async function loadInput(db: Db, lead: Lead, now: Date): Promise<RoutingInput> {
  const person = await db.persons.get(lead.personId);
  if (!person) throw new Error(`person not found for lead ${lead.id}`);
  const household = person.householdId
    ? (await db.persons.list((p) => p.householdId === person.householdId && p.id !== person.id)).map((p) => p.id)
    : [];
  return {
    lead,
    person,
    householdPersonIds: household,
    lawyers: await db.lawyers.list(),
    assignments: await db.assignments.list(),
    leads: await db.leads.list(),
    consults: await db.consults.list(),
    now,
  };
}

export async function offerNext(db: Db, leadId: string, now = new Date()): Promise<OfferResult> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error(`lead not found: ${leadId}`);
  if (lead.exit) throw new Error("Lead has already exited the pipeline");
  if (lead.conflictCard.clearance === "conflict") throw new Error("Lead has a conflict and cannot be offered");
  const history = await db.assignments.list(undefined, { leadId });
  if (lead.assignedLawyerId || history.some((a) => a.status === "accepted")) throw new Error("Lead is already accepted");
  if (history.some((a) => a.status === "offered")) throw new Error("Lead already has an open offer");

  const result = rankLawyers(await loadInput(db, lead, now));
  const top = result.ranked[0];
  if (!top) {
    const hadOffer = history.length > 0;
    await db.leads.update(leadId, {
      exit: hadOffer
        ? { reason: "declined_by_all", at: now.toISOString() }
        : { reason: "not_a_fit", at: now.toISOString(), note: "No eligible attorney" },
    });
    await audit(db, "system", {
      action: "routing.no_eligible",
      resourceType: "lead",
      resourceId: leadId,
      leadId,
      at: now,
      detail: { excluded: result.excluded, priorOffers: history.length },
    });
    return { offered: null, nextStep: "refer_to_bar_referral_service_and_long_term_nurture" };
  }

  const lawyer = (await db.lawyers.get(top.lawyerId))!;
  const assignment = await db.assignments.insert({
    id: randomUUID(),
    leadId,
    lawyerId: lawyer.id,
    firmId: lawyer.firmId,
    offeredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lawyer.acceptSlaMinutes * 60_000).toISOString(),
    status: "offered",
    routingReason: top.reason,
  });
  await db.leads.update(leadId, {
    stage: "offered",
    stageHistory: [...lead.stageHistory, { stage: "offered", at: now.toISOString(), by: "system" }],
  });
  await audit(db, "system", {
    action: "routing.offer",
    resourceType: "assignment",
    resourceId: assignment.id,
    leadId,
    at: now,
    detail: { lawyerId: lawyer.id, special: result.special ?? null, expiresAt: assignment.expiresAt },
  });
  return { offered: assignment };
}

async function ownOffer(db: Db, actor: Actor, assignmentId: string): Promise<Assignment> {
  const a = await db.assignments.get(assignmentId);
  if (!a) throw new Error(`assignment not found: ${assignmentId}`);
  if (actor.role !== "attorney" || !actor.lawyerId || actor.lawyerId !== a.lawyerId) {
    throw new ForbiddenError("Only the offered attorney can respond to this offer");
  }
  return a;
}

export async function acceptOffer(db: Db, actor: Actor, assignmentId: string, now = new Date()): Promise<Lead> {
  const a = await ownOffer(db, actor, assignmentId);
  if (a.status !== "offered") throw new Error(`Offer is ${a.status}`);
  if (new Date(a.expiresAt) <= now) throw new Error("Offer has expired");
  const lead = (await db.leads.get(a.leadId))!;
  if (lead.exit) throw new Error("Lead has already exited the pipeline");
  await db.assignments.update(a.id, { status: "accepted", respondedAt: now.toISOString(), slaMet: true });
  const updated = await db.leads.update(lead.id, {
    assignedLawyerId: a.lawyerId,
    firmId: a.firmId,
    stage: "accepted",
    stageHistory: [...lead.stageHistory, { stage: "accepted", at: now.toISOString(), by: actor.userId }],
  });
  await audit(db, actor, {
    action: "routing.accept",
    resourceType: "assignment",
    resourceId: a.id,
    leadId: lead.id,
    at: now,
    detail: { lawyerId: a.lawyerId },
  });
  return updated;
}

export async function declineOffer(
  db: Db,
  actor: Actor,
  assignmentId: string,
  reason: DeclineReason,
  note?: string,
  now = new Date(),
): Promise<OfferResult | { offered: null; conflict: true }> {
  if (!reason) throw new Error("A decline reason is required");
  const a = await ownOffer(db, actor, assignmentId);
  if (a.status !== "offered") throw new Error(`Offer is ${a.status}`);
  await db.assignments.update(a.id, { status: "declined", declineReason: reason, note, respondedAt: now.toISOString(), slaMet: true });

  if (reason === "conflict") {
    // In Model A a conflict for one lawyer is a conflict for the whole firm, so
    // nobody else gets the lead until an attorney reviews it.
    const lead = (await db.leads.get(a.leadId))!;
    await db.leads.update(lead.id, { conflictCard: { ...lead.conflictCard, clearance: "conflict" } });
    await db.activities.insert({
      id: randomUUID(),
      leadId: lead.id,
      kind: "system",
      at: now.toISOString(),
      summary: "An attorney reported a conflict. Routing is paused until an attorney reviews it.",
    });
    await audit(db, actor, { action: "routing.conflict", resourceType: "assignment", resourceId: a.id, leadId: lead.id, at: now });
    return { offered: null, conflict: true };
  }
  await audit(db, actor, {
    action: "routing.decline",
    resourceType: "assignment",
    resourceId: a.id,
    leadId: a.leadId,
    at: now,
    detail: { reason },
  });
  return await offerNext(db, a.leadId, now);
}

/** Cron entry point: expires overdue offers, logs the SLA miss and moves each lead on. */
export async function sweepExpiredOffers(db: Db, now = new Date()): Promise<{ expired: number; reoffered: number; exhausted: number }> {
  const overdue = await db.assignments.list((a) => a.status === "offered" && new Date(a.expiresAt) <= now);
  const leadIds = new Set<string>();
  for (const a of overdue) {
    await db.assignments.update(a.id, { status: "expired", slaMet: false });
    await audit(db, "system", {
      action: "routing.timeout",
      resourceType: "assignment",
      resourceId: a.id,
      leadId: a.leadId,
      at: now,
      detail: { lawyerId: a.lawyerId, expiresAt: a.expiresAt },
    });
    leadIds.add(a.leadId);
  }
  let reoffered = 0;
  let exhausted = 0;
  for (const id of leadIds) {
    try {
      if ((await offerNext(db, id, now)).offered) reoffered++;
      else exhausted++;
    } catch {
      // Conflict or exit since the offer went out: nothing to route.
    }
  }
  return { expired: overdue.length, reoffered, exhausted };
}

export async function recordClientChoice(db: Db, leadId: string, lawyerIds: string[], now = new Date()): Promise<Lead> {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new Error(`lead not found: ${leadId}`);
  const unique = [...new Set(lawyerIds)];
  if (unique.length === 0 || unique.length > 3) throw new Error("Choose between 1 and 3 attorneys");
  for (const id of unique) if (!await db.lawyers.get(id)) throw new Error(`lawyer not found: ${id}`);
  const updated = await db.leads.update(leadId, { clientChoiceLawyerIds: unique });
  await audit(db, "system", { action: "routing.client_choice", resourceType: "lead", resourceId: leadId, leadId, at: now, detail: { lawyerIds: unique } });
  return updated;
}
