/**
 * Intake triage. Decides which lane a new lead is worked in before anyone calls:
 *
 * - after_death: a family handling an estate. A person calls within the hour, the
 *   on-call attorney and the platform admin are told at once, and the lead never
 *   gets marketing nurture (the scheduler's grief track handles follow-up).
 * - priority: Medicaid and long-term care, executor or probate questions, and
 *   estates large enough for estate tax. These jump the queue behind urgent leads.
 * - out_of_practice: a matter the firm does not take. The lead exits politely
 *   instead of being offered to an attorney.
 * - standard: everyone else, on the normal speed-to-lead target.
 *
 * Out-of-state leads are already closed by scoring (src/lib/scoring.ts) before
 * they reach the portal, so triage does not repeat that check.
 */
import { randomUUID } from "node:crypto";
import { audit } from "@/server/audit/log";
import type { Db } from "@/server/db";
import { isGriefLead } from "@/server/nurture/scheduler";
import type { Lead, MatterType } from "@/server/types";

export type TriageLane = "after_death" | "priority" | "out_of_practice" | "standard";

export interface Triage {
  lane: TriageLane;
  /** Short labels for staff. Never names or case facts. */
  reasons: string[];
  /** Minutes by which a person must call, when tighter than the normal target */
  callWithinMinutes?: number;
}

export const AFTER_DEATH_CALL_MINUTES = 60;
export const AFTER_DEATH_TASK_PREFIX = "Call within 1 hour";

const PRIORITY_SEGMENTS: Record<string, string> = {
  medicaid_planning_interest: "Medicaid or long-term care",
  caregiver: "Medicaid or long-term care",
  estate_tax_watch: "Possible estate tax",
};

/**
 * Matter types the firm takes. PORTAL_PRACTICE_MATTERS is a comma-separated list;
 * unset means every matter type, so nothing is turned away until the firm says so.
 */
export function practiceMatters(): MatterType[] | null {
  const raw = process.env.PORTAL_PRACTICE_MATTERS?.trim();
  if (!raw) return null;
  return raw.split(",").map((s) => s.trim()).filter(Boolean) as MatterType[];
}

export function triageLead(lead: Pick<Lead, "matterType" | "segments" | "capture" | "intake">, practice = practiceMatters()): Triage {
  if (isGriefLead(lead)) {
    return { lane: "after_death", reasons: ["Family handling an estate"], callWithinMinutes: AFTER_DEATH_CALL_MINUTES };
  }
  if (practice && !practice.includes(lead.matterType)) {
    return { lane: "out_of_practice", reasons: ["Outside the firm's practice"] };
  }
  const reasons = new Set<string>();
  if (lead.matterType === "elder_law") reasons.add("Medicaid or long-term care");
  for (const s of lead.segments) if (PRIORITY_SEGMENTS[s]) reasons.add(PRIORITY_SEGMENTS[s]);
  if (lead.intake?.assets?.range === "over_5m") reasons.add("Possible estate tax");
  if (reasons.size) return { lane: "priority", reasons: [...reasons] };
  return { lane: "standard", reasons: [] };
}

/**
 * Acts on a new lead's lane once: opens the one-hour call task for after-death
 * leads and closes out-of-practice leads. Safe to call again; it does nothing
 * the second time.
 */
export async function applyTriage(db: Db, leadId: string, now = new Date()): Promise<Triage | null> {
  const lead = await db.leads.get(leadId);
  if (!lead) return null;
  const done = await db.audit.list((e) => e.action === "lead.triage" && e.leadId === leadId, { leadId });
  if (done.length) return null;
  const t = triageLead(lead);

  if (t.lane === "after_death" && !lead.exit) {
    await db.tasks.insert({
      id: randomUUID(),
      leadId,
      title: `${AFTER_DEATH_TASK_PREFIX}: family handling an estate. Listen first, no sales script.`,
      ownerId: lead.intakeOwnerId ?? "unassigned",
      dueAt: new Date(now.getTime() + AFTER_DEATH_CALL_MINUTES * 60_000).toISOString(),
    });
  }
  if (t.lane === "out_of_practice" && !lead.exit) {
    await db.leads.update(leadId, { exit: { reason: "not_a_fit", at: now.toISOString(), note: "Outside the firm's practice" } });
  }
  await audit(db, "system", { action: "lead.triage", resourceType: "lead", resourceId: leadId, leadId, detail: { lane: t.lane }, at: now });
  return t;
}
