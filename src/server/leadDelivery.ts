/**
 * Delivery log for the website's direct webhook feed (src/lib/crm.ts). The portal backend's own CRM
 * sync lives in src/server/crm/* and is separate; this covers the Zapier, Make or n8n webhook.
 *
 * The log holds ids, status, HTTP code, attempt count and a short error, never the payload, so it
 * contains no personal data. Retrying therefore needs the lead record from elsewhere: by default it
 * is rebuilt from the portal copy of the lead (leadRecordFromPortal), which exists when
 * PORTAL_INGEST_LEADS is on.
 */
import { deliverLead, idempotencyKey, LEAD_CREATED_EVENT, type DeliveryOptions, type DeliveryResult, type LeadRecord } from "@/lib/crm";
import type { Db } from "@/server/db";
import type { CrmDelivery } from "@/server/types";

/** After this many HTTP attempts in total, a failing delivery is abandoned and needs a person. */
export const MAX_TOTAL_ATTEMPTS = 12;
/** Attempts made by the original request before the sweep takes over. */
const SWEEP_BASE_ATTEMPTS = 3;

/** Minutes to wait before the sweep retries, given attempts so far: 2, 4, 8, 16, 32, then 60. */
export function retryDelayMinutes(attempts: number): number {
  return Math.min(60, 2 * 2 ** Math.max(0, attempts - SWEEP_BASE_ATTEMPTS));
}

/**
 * Writes or updates the delivery record for one lead and event. Never stores the payload.
 * A target of "log" (no webhook configured) writes nothing.
 */
export async function recordDelivery(
  db: Db,
  leadId: string,
  event: string,
  result: DeliveryResult,
  now = new Date(),
): Promise<CrmDelivery | undefined> {
  if (result.target !== "webhook") return undefined;
  const id = result.idempotencyKey ?? idempotencyKey(leadId, event);
  const at = now.toISOString();
  const existing = await db.crmDeliveries.get(id);
  const attempts = (existing?.attempts ?? 0) + (result.attempts ?? 0);
  const status: CrmDelivery["status"] = result.delivered
    ? "delivered"
    : result.retryable && attempts < MAX_TOTAL_ATTEMPTS
      ? "failed"
      : "abandoned";
  const base = {
    status,
    httpStatus: result.status,
    attempts,
    error: result.delivered ? undefined : (result.error ?? "unknown error"),
    updatedAt: at,
    lastAttemptAt: at,
    deliveredAt: result.delivered ? at : existing?.deliveredAt,
  };
  if (existing) return db.crmDeliveries.update(id, base);
  return db.crmDeliveries.insert({ id, leadId, event, createdAt: at, ...base });
}

/**
 * Delivers a lead to the webhook and logs the outcome. Logging failures are swallowed, because losing
 * a log row must never fail the request that already did the real work.
 */
export async function deliverAndLog(
  getDb: () => Promise<Db>,
  lead: LeadRecord,
  fetchImpl: typeof fetch = fetch,
  opts: DeliveryOptions = {},
  now = () => new Date(),
): Promise<DeliveryResult> {
  const event = opts.event ?? LEAD_CREATED_EVENT;
  const result = await deliverLead(lead, fetchImpl, { ...opts, event });
  if (result.target === "webhook") {
    try {
      await recordDelivery(await getDb(), lead.id, event, result, now());
    } catch (err) {
      console.error("crm delivery log write failed", { id: lead.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

/** Rebuilds a LeadRecord from the portal's lead and person, or undefined if the lead was never ingested. */
export async function leadRecordFromPortal(db: Db, leadId: string): Promise<LeadRecord | undefined> {
  const lead = await db.leads.get(leadId);
  if (!lead) return undefined;
  const person = await db.persons.get(lead.personId);
  if (!person) return undefined;
  const source = lead.source as LeadRecord["source"];
  return {
    id: lead.id,
    receivedAt: lead.createdAt,
    contact: {
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: person.phone,
      state: lead.state as LeadRecord["contact"]["state"],
      county: lead.county ?? person.county,
      language: person.language,
    },
    // The portal does not keep the stated contact preference; text only with SMS consent.
    contactMethod: lead.consent.smsConsent ? "text" : "phone",
    goals: lead.intake.goals,
    answers: lead.intake.answers,
    score: lead.score,
    segments: lead.segments,
    source,
    heardFrom: source.heardFrom,
    capture: (lead.capture ?? { tool: "plan_finder" }) as LeadRecord["capture"],
    visitorId: lead.visitorId,
    priorTools: (lead.priorTools ?? []) as LeadRecord["priorTools"],
    consent: lead.consent,
  };
}

export interface RetryOptions {
  fetchImpl?: typeof fetch;
  now?: Date;
  /** Most deliveries to retry in one sweep. Default 25. */
  limit?: number;
  /** Where to get the record to resend. Default: rebuild it from the portal lead. */
  loadRecord?: (leadId: string) => Promise<LeadRecord | undefined>;
  delivery?: DeliveryOptions;
}

export interface RetrySummary {
  considered: number;
  delivered: number;
  stillFailing: number;
  abandoned: number;
  /** Not yet due for another try */
  skipped: number;
}

/**
 * Retries deliveries in "failed" status. Called from the cron sweep: one HTTP attempt per delivery per
 * sweep (no sleeping), spaced by retryDelayMinutes. A delivery whose record cannot be loaded, or that
 * the middleware now rejects with a non-retryable 4xx, becomes "abandoned" so it shows on the lead
 * health page for a person to handle. The same idempotency key is sent every time.
 */
export async function retryFailedDeliveries(db: Db, opts: RetryOptions = {}): Promise<RetrySummary> {
  const now = opts.now ?? new Date();
  const load = opts.loadRecord ?? ((id: string) => leadRecordFromPortal(db, id));
  const failed = (await db.crmDeliveries.list(undefined, { status: "failed" })).sort((a, b) => a.lastAttemptAt.localeCompare(b.lastAttemptAt));
  const summary: RetrySummary = { considered: 0, delivered: 0, stillFailing: 0, abandoned: 0, skipped: 0 };
  const limit = opts.limit ?? 25;
  for (const row of failed) {
    const dueAt = new Date(row.lastAttemptAt).getTime() + retryDelayMinutes(row.attempts) * 60_000;
    if (dueAt > now.getTime()) {
      summary.skipped++;
      continue;
    }
    if (summary.considered >= limit) break;
    summary.considered++;
    const record = await load(row.leadId);
    if (!record) {
      await db.crmDeliveries.update(row.id, {
        status: "abandoned",
        error: "lead record not available for retry",
        updatedAt: now.toISOString(),
      });
      summary.abandoned++;
      continue;
    }
    const result = await deliverLead(record, opts.fetchImpl ?? fetch, { ...opts.delivery, event: row.event, maxAttempts: 1 });
    if (result.target !== "webhook") {
      // Webhook was switched off since the failure: nothing to retry against.
      summary.skipped++;
      continue;
    }
    const updated = await recordDelivery(db, row.leadId, row.event, result, now);
    if (updated?.status === "delivered") summary.delivered++;
    else if (updated?.status === "abandoned") summary.abandoned++;
    else summary.stillFailing++;
  }
  return summary;
}
