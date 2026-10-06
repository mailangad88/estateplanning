/**
 * Small helpers shared by the engagement flow (engagement.ts) and the retainer payment
 * flow (retainerPayments.ts), kept apart so the two modules do not import each other.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "@/server/db";
import { STAGES, type Engagement, type EngagementStatus, type Lead, type Stage } from "@/server/types";

export async function getEngagement(db: Db, id: string): Promise<Engagement> {
  const e = await db.engagements.get(id);
  if (!e) throw new Error(`engagement not found: ${id}`);
  return e;
}

export async function leadFor(db: Db, e: Engagement): Promise<Lead> {
  const lead = await db.leads.get(e.leadId);
  if (!lead) throw new Error(`lead not found: ${e.leadId}`);
  return lead;
}

/** Moves the lead stage forward only. */
export async function advanceStage(db: Db, lead: Lead, stage: Stage, by: string, at: string) {
  const current = await db.leads.get(lead.id) ?? lead;
  if (STAGES.indexOf(stage) <= STAGES.indexOf(current.stage)) return;
  await db.leads.update(lead.id, { stage, stageHistory: [...current.stageHistory, { stage, at, by }] });
}

export async function systemNote(db: Db, leadId: string, summary: string, at: string, byUserId?: string) {
  await db.activities.insert({ id: randomUUID(), leadId, kind: "system", at, summary, byUserId });
}

/** Forward order of engagement statuses. "voided" is terminal and handled separately. */
export const RANK: Record<EngagementStatus, number> = { draft: 0, approved: 1, sent: 2, viewed: 3, signed: 4, paid: 5, countersigned: 6, voided: -1 };

export function seen(e: Engagement, status: EngagementStatus) {
  return e.history.some((h) => h.status === status);
}

/** Moves to `status` only if it is ahead of the current one; always records the history entry once. */
export async function applyStatus(db: Db, e: Engagement, status: EngagementStatus, at: string): Promise<Engagement> {
  const history = seen(e, status) ? e.history : [...e.history, { status, at }];
  const forward = RANK[status] > RANK[e.status];
  return await db.engagements.update(e.id, { status: forward ? status : e.status, history });
}
