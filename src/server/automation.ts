/**
 * Automation runner. Rather than every service calling nurture and CRM hooks
 * directly, the runner reads the audit log as an event feed and reconciles:
 * new leads are triaged, enrolled and synced, stage changes move nurture sequences and the
 * CRM pipeline, exits stop pre-sale sequences, and firm-visible comments reach the
 * CRM. Because it compares each lead's current state with the last state it acted
 * on, a missed or repeated run cannot double-enroll or skip a stage.
 *
 * Runs from the cron sweep. CRM failures are logged and retried on the next run.
 */
import type { CrmSync } from "@/server/crm/sync";
import type { AutomationState, Db } from "@/server/db";
import { syncReviewRequests } from "@/server/nurture/reviews";
import { enrollForNewLead, onExit, onStageChange, sweepQuietLeads } from "@/server/nurture/scheduler";
import { applyTriage } from "@/server/services/triage";
import type { ExitReason, Stage } from "@/server/types";

async function loadState(db: Db): Promise<AutomationState> {
  return await db.automationState.get("automation") ?? await db.automationState.insert({ id: "automation", cursorSeq: 0, stages: {}, exits: {} });
}

export interface AutomationResult {
  processedEvents: number;
  enrolled: number;
  stageChanges: number;
  exits: number;
  crmSynced: number;
  crmFailures: number;
  movedToLongTerm: number;
  reviewRequestsStarted: number;
}

export async function runAutomations(db: Db, crm: CrmSync | null, now = new Date()): Promise<AutomationResult> {
  const state = await loadState(db);
  const events = (await db.audit.list((e) => e.seq > state.cursorSeq)).sort((a, b) => a.seq - b.seq);
  const result: AutomationResult = { processedEvents: events.length, enrolled: 0, stageChanges: 0, exits: 0, crmSynced: 0, crmFailures: 0, movedToLongTerm: 0, reviewRequestsStarted: 0 };

  const touchedLeads = new Set<string>();
  const newLeads: string[] = [];
  const comments: string[] = [];
  for (const e of events) {
    if (e.leadId) touchedLeads.add(e.leadId);
    if (e.action === "lead.create") newLeads.push(e.resourceId);
    if (e.action === "comment.create") comments.push(e.resourceId);
  }

  const crmCall = async (fn: () => Promise<unknown>) => {
    if (!crm) return;
    try {
      await fn();
      result.crmSynced++;
    } catch (err) {
      result.crmFailures++;
      console.error("crm sync failed", { error: err instanceof Error ? err.message : String(err) });
    }
  };

  for (const id of newLeads) {
    if (state.stages[id]) continue;
    // Triage first: an out-of-practice lead exits here and so never enrolls in nurture.
    await applyTriage(db, id, now);
    const lead = await db.leads.get(id);
    if (!lead) continue;
    if (!lead.exit) result.enrolled += (await enrollForNewLead(db, lead, now)).length;
    state.stages[id] = lead.stage;
    await crmCall(() => crm!.syncLead(db, id));
  }

  // Retry leads whose first CRM sync failed on an earlier run.
  if (crm) {
    for (const lead of await db.leads.list((l) => !l.crmId && state.stages[l.id] !== undefined && !newLeads.includes(l.id))) {
      await crmCall(() => crm.syncLead(db, lead.id));
    }
  }

  for (const id of touchedLeads) {
    const lead = await db.leads.get(id);
    if (!lead) continue;
    if (state.stages[id] !== lead.stage) {
      if (state.stages[id] !== undefined) {
        await onStageChange(db, id, lead.stage as Stage, now);
        result.stageChanges++;
        await crmCall(() => crm!.syncStage(db, id));
      }
      state.stages[id] = lead.stage;
    }
    if (lead.exit && state.exits[id] !== lead.exit.reason) {
      await onExit(db, id, lead.exit.reason as ExitReason, now);
      state.exits[id] = lead.exit.reason;
      result.exits++;
      await crmCall(() => crm!.syncStage(db, id));
    }
  }

  for (const id of comments) await crmCall(() => crm!.syncComment(db, id));

  result.movedToLongTerm = (await sweepQuietLeads(db, now)).length;
  // Review requests missed by the stage hook (and opt-outs to copy onto the tracking rows).
  result.reviewRequestsStarted = (await syncReviewRequests(db, now)).started.length;
  // Advance only past the events read at the start: anything written meanwhile (including this run's
  // own sync and nurture events) is read next time, where it reconciles to a no-op if nothing changed.
  const lastSeq = events.at(-1)?.seq ?? state.cursorSeq;
  await db.automationState.update("automation", { cursorSeq: lastSeq, stages: state.stages, exits: state.exits });
  return result;
}
