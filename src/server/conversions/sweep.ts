/**
 * Offline conversion import: CRM stage changes sent back to Google Ads and Meta so ad spend optimizes on
 * retained clients rather than form fills.
 *
 * `sweepConversions` is the one entry point for the cron sweep. It (1) reads each ad-sourced lead's stage
 * history and writes one conversions-log row per lead, conversion and platform (so an event is sent once),
 * then (2) uploads whatever is pending. Consent and sensitive-segment rules are re-checked at send time.
 * A platform with no credentials in production is refused: its rows stay pending and the result says so.
 */
import { audit } from "@/server/audit/log";
import { assertCan, can } from "@/server/auth/policy";
import {
  CONVERSION_PROVIDERS,
  CONVERSION_CURRENCY,
  MAX_AGE_DAYS,
  conversionBlock,
  conversionEventId,
  conversionRowId,
  conversionTimes,
  engagementFeeCents,
  platformsFor,
} from "@/server/conversions/events";
import { googleCsv, googleRow, metaCsv, metaEvent, type GoogleConversionRow, type MetaEvent } from "@/server/conversions/format";
import {
  ConversionConfigError,
  googleUploaderFromEnv,
  metaUploaderFromEnv,
  type ConversionUploader,
  type UploadItem,
  type UploadResult,
} from "@/server/conversions/providers";
import type { Db } from "@/server/db";
import type { Actor, ConversionEvent, ConversionProvider } from "@/server/types";

const DAY = 86_400_000;
/** After this many failed attempts a row is abandoned and needs a person. */
export const MAX_ATTEMPTS = 5;
const BATCH = 200;

export type GoogleItem = GoogleConversionRow & { type: ConversionEvent["type"] };

export interface ConversionUploaders {
  google_ads: ConversionUploader<GoogleItem>;
  meta: ConversionUploader<MetaEvent>;
}

export interface SweepOptions {
  now?: Date;
  /** Defaults to the environment: live with credentials, mock in development, refused in production without them. */
  uploaders?: Partial<ConversionUploaders>;
  /** IANA zone for Google conversion times. Default UTC (the offset is always written out). */
  timeZone?: string;
}

export interface ConversionSweepResult {
  queued: number;
  skipped: number;
  sent: number;
  failed: number;
  abandoned: number;
  /** Platforms that were not uploaded to because production had no credentials. Their rows stay pending. */
  refused: ConversionProvider[];
}

// ---------- 1. Queue ----------

/** Writes a log row for every conversion each ad-sourced lead has reached and does not have a row for yet. */
export async function queueConversions(db: Db, now: Date): Promise<{ queued: number; skipped: number }> {
  const existing = new Set((await db.conversionEvents.list()).map((e) => e.id));
  let queued = 0;
  let skipped = 0;
  for (const lead of await db.leads.list()) {
    const platforms = platformsFor(lead);
    if (!platforms.length) continue;
    const times = conversionTimes(lead);
    const person = await db.persons.get(lead.personId);
    let block: string | undefined | null = null; // computed lazily, once per lead
    for (const [type, occurredAt] of Object.entries(times) as [ConversionEvent["type"], string][]) {
      for (const provider of platforms) {
        const id = conversionRowId(provider, type, lead.id);
        if (existing.has(id)) continue;
        if (block === null) block = await conversionBlock(db, lead, person);
        const stale = now.getTime() - Date.parse(occurredAt) > MAX_AGE_DAYS[provider] * DAY;
        const reason = block ?? (stale ? "too_old" : undefined);
        const row: ConversionEvent = {
          id,
          leadId: lead.id,
          provider,
          type,
          eventId: conversionEventId(type, lead.id),
          occurredAt,
          valueCents: type === "retainer_signed" ? await engagementFeeCents(db, lead.id) : undefined,
          currency: CONVERSION_CURRENCY,
          status: reason ? "skipped" : "pending",
          reason,
          attempts: 0,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        await db.conversionEvents.insert(row);
        existing.add(id);
        await audit(db, "system", {
          action: reason ? "conversion.skipped" : "conversion.queued",
          resourceType: "conversion_event",
          resourceId: id,
          leadId: lead.id,
          detail: { provider, type, ...(reason ? { reason } : {}) },
          at: now,
        });
        if (reason) skipped++;
        else queued++;
      }
    }
  }
  return { queued, skipped };
}

// ---------- 2. Prepare and send ----------

type Prepared =
  | { ok: true; row: ConversionEvent; google?: GoogleItem; meta?: MetaEvent }
  | { ok: false; row: ConversionEvent; reason: string };

/** Rebuilds the payload from the lead as it is now, and re-applies the consent, sensitive and age rules. */
async function prepare(db: Db, row: ConversionEvent, now: Date, timeZone?: string): Promise<Prepared> {
  const lead = await db.leads.get(row.leadId);
  const person = lead ? await db.persons.get(lead.personId) : undefined;
  if (!lead || !person) return { ok: false, row, reason: "lead_missing" };
  const block = await conversionBlock(db, lead, person);
  if (block) return { ok: false, row, reason: block };
  if (now.getTime() - Date.parse(row.occurredAt) > MAX_AGE_DAYS[row.provider] * DAY) return { ok: false, row, reason: "too_old" };
  const valueCents = row.valueCents ?? (row.type === "retainer_signed" ? await engagementFeeCents(db, lead.id) : undefined);
  const input = { lead, person, type: row.type, occurredAt: row.occurredAt, valueCents };
  if (row.provider === "google_ads") {
    const g = googleRow(input, timeZone);
    return g ? { ok: true, row: { ...row, valueCents }, google: { ...g, type: row.type } } : { ok: false, row, reason: "no_click_id" };
  }
  const consult = row.type === "consult_held" ? (await db.consults.list((c) => c.status === "held", { leadId: lead.id }))[0] : undefined;
  const m = metaEvent(input, { inPerson: consult?.type === "office" });
  return m ? { ok: true, row: { ...row, valueCents }, meta: m } : { ok: false, row, reason: "no_click_id" };
}

async function markSkipped(db: Db, row: ConversionEvent, reason: string, now: Date): Promise<void> {
  await db.conversionEvents.update(row.id, { status: "skipped", reason, updatedAt: now.toISOString() });
  await audit(db, "system", {
    action: "conversion.skipped",
    resourceType: "conversion_event",
    resourceId: row.id,
    leadId: row.leadId,
    detail: { provider: row.provider, type: row.type, reason },
    at: now,
  });
}

const sendable = (e: ConversionEvent) => e.status === "pending" || (e.status === "failed" && e.attempts < MAX_ATTEMPTS);

async function recordResult(db: Db, row: ConversionEvent, r: UploadResult, channel: string, now: Date): Promise<"sent" | "failed" | "abandoned"> {
  const at = now.toISOString();
  let status: "sent" | "failed" | "abandoned";
  let patch: Partial<ConversionEvent>;
  if (r.ok) {
    status = "sent";
    patch = { status, sentAt: at, channel, reason: undefined, updatedAt: at, valueCents: row.valueCents };
  } else {
    const attempts = row.attempts + 1;
    status = r.retryable && attempts < MAX_ATTEMPTS ? "failed" : "abandoned";
    patch = { status, attempts, reason: r.error ?? "upload failed", updatedAt: at };
  }
  await db.conversionEvents.update(row.id, patch);
  await audit(db, "system", {
    action: `conversion.${status === "sent" ? "sent" : "failed"}`,
    resourceType: "conversion_event",
    resourceId: row.id,
    leadId: row.leadId,
    detail: { provider: row.provider, type: row.type, status, channel, ...(r.ok ? {} : { error: r.error }) },
    at: now,
  });
  return status;
}

export async function sendPendingConversions(
  db: Db,
  uploaders: Partial<ConversionUploaders>,
  now: Date,
  timeZone?: string,
): Promise<Pick<ConversionSweepResult, "skipped" | "sent" | "failed" | "abandoned">> {
  const out = { skipped: 0, sent: 0, failed: 0, abandoned: 0 };
  for (const provider of CONVERSION_PROVIDERS) {
    const uploader = uploaders[provider];
    if (!uploader) continue;
    const rows = (await db.conversionEvents.list(sendable, { provider })).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const items: { prep: Extract<Prepared, { ok: true }>; item: UploadItem<unknown> }[] = [];
    for (const row of rows) {
      const prep = await prepare(db, row, now, timeZone);
      if (!prep.ok) {
        await markSkipped(db, row, prep.reason, now);
        out.skipped++;
      } else {
        items.push({ prep, item: { id: row.id, payload: prep.google ?? prep.meta } });
      }
    }
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      let results: UploadResult[];
      try {
        results = await (uploader as ConversionUploader<unknown>).upload(batch.map((b) => b.item));
      } catch (err) {
        console.error("conversion upload threw", { provider, error: err instanceof Error ? err.name : "unknown" });
        results = batch.map((b) => ({ id: b.item.id, ok: false, retryable: true, error: "uploader error" }));
      }
      const byId = new Map(results.map((r) => [r.id, r]));
      for (const b of batch) {
        const r = byId.get(b.item.id) ?? { id: b.item.id, ok: false, retryable: true, error: "no result returned" };
        out[await recordResult(db, b.prep.row, r, uploader.channel, now)]++;
      }
    }
  }
  return out;
}

/** Resolves uploaders from the environment; a platform that is refused is left out and reported. */
export function resolveUploaders(env: Record<string, string | undefined> = process.env): { uploaders: Partial<ConversionUploaders>; refused: ConversionProvider[] } {
  const uploaders: Partial<ConversionUploaders> = {};
  const refused: ConversionProvider[] = [];
  try {
    uploaders.google_ads = googleUploaderFromEnv(env);
  } catch (err) {
    if (!(err instanceof ConversionConfigError)) throw err;
    refused.push("google_ads");
  }
  try {
    uploaders.meta = metaUploaderFromEnv(env);
  } catch (err) {
    if (!(err instanceof ConversionConfigError)) throw err;
    refused.push("meta");
  }
  return { uploaders, refused };
}

/**
 * Cron entry point. Queues new conversions and uploads what is pending. Safe to run every minute or every hour:
 * each event has one log row and is sent once. Wire it into src/app/api/cron/sweep/route.ts.
 */
export async function sweepConversions(db: Db, opts: SweepOptions = {}): Promise<ConversionSweepResult> {
  const now = opts.now ?? new Date();
  const q = await queueConversions(db, now);
  let uploaders = opts.uploaders;
  let refused: ConversionProvider[] = [];
  if (!uploaders) ({ uploaders, refused } = resolveUploaders());
  const sent = await sendPendingConversions(db, uploaders, now, opts.timeZone);
  return { queued: q.queued, skipped: q.skipped + sent.skipped, sent: sent.sent, failed: sent.failed, abandoned: sent.abandoned, refused };
}

// ---------- 3. Manual upload (CSV) ----------

export interface CsvExport {
  csv: string;
  filename: string;
  count: number;
  ids: string[];
}

/**
 * CSV for a manual upload to Google Ads or Meta Events Manager: the rows not yet sent. With `markSent` the
 * rows are recorded as sent through channel "manual_csv" (so the sweep will not send them again) and the
 * export is audited; without it nothing changes, so the file can be previewed.
 */
export async function exportConversionsCsv(
  db: Db,
  actor: Actor,
  provider: ConversionProvider,
  opts: { markSent?: boolean; idKind?: "gclid" | "gbraid" | "wbraid"; now?: Date; timeZone?: string } = {},
): Promise<CsvExport> {
  assertCan(can(actor, opts.markSent ? "manage_conversions" : "view_conversions"));
  const now = opts.now ?? new Date();
  const rows = (await db.conversionEvents.list(sendable, { provider })).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const included: Extract<Prepared, { ok: true }>[] = [];
  for (const row of rows) {
    const prep = await prepare(db, row, now, opts.timeZone);
    if (prep.ok) included.push(prep);
    else if (opts.markSent) await markSkipped(db, row, prep.reason, now);
  }
  const kind = opts.idKind ?? "gclid";
  const chosen = provider === "google_ads" ? included.filter((p) => p.google!.clickIdKind === kind) : included;
  const csv = provider === "google_ads" ? googleCsv(chosen.map((p) => p.google!), kind) : metaCsv(chosen.map((p) => p.meta!));
  const ids = chosen.map((p) => p.row.id);
  if (opts.markSent) {
    for (const p of chosen) {
      await db.conversionEvents.update(p.row.id, { status: "sent", sentAt: now.toISOString(), channel: "manual_csv", reason: undefined, updatedAt: now.toISOString(), valueCents: p.row.valueCents });
    }
    await audit(db, actor, {
      action: "conversion.exported",
      resourceType: "conversion_export",
      resourceId: `${provider}:${now.toISOString()}`,
      detail: { provider, count: ids.length, idKind: provider === "google_ads" ? kind : undefined },
      at: now,
    });
  }
  return { csv, filename: `${provider}-conversions-${now.toISOString().slice(0, 10)}.csv`, count: ids.length, ids };
}

// ---------- 4. Report ----------

export interface ConversionsReport {
  generatedAt: string;
  byProvider: Record<ConversionProvider, Record<ConversionEvent["status"], number>>;
  skippedReasons: Record<string, number>;
  recent: Pick<ConversionEvent, "id" | "leadId" | "provider" | "type" | "status" | "reason" | "attempts" | "valueCents" | "occurredAt" | "sentAt" | "channel">[];
}

export async function conversionsReport(db: Db, actor: Actor, now = new Date()): Promise<ConversionsReport> {
  assertCan(can(actor, "view_conversions"));
  const rows = await db.conversionEvents.list();
  const empty = () => ({ pending: 0, sent: 0, failed: 0, abandoned: 0, skipped: 0 });
  const byProvider = { google_ads: empty(), meta: empty() };
  const skippedReasons: Record<string, number> = {};
  for (const r of rows) {
    byProvider[r.provider][r.status]++;
    if (r.status === "skipped") skippedReasons[r.reason ?? "unknown"] = (skippedReasons[r.reason ?? "unknown"] ?? 0) + 1;
  }
  const recent = rows
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 50)
    .map(({ id, leadId, provider, type, status, reason, attempts, valueCents, occurredAt, sentAt, channel }) => ({ id, leadId, provider, type, status, reason, attempts, valueCents, occurredAt, sentAt, channel }));
  return { generatedAt: now.toISOString(), byProvider, skippedReasons, recent };
}

/** Moves abandoned rows back to pending (attempts reset) after a person fixed the cause. */
export async function retryAbandonedConversions(db: Db, actor: Actor, now = new Date()): Promise<number> {
  assertCan(can(actor, "manage_conversions"));
  const rows = await db.conversionEvents.list((e) => e.status === "abandoned");
  for (const r of rows) {
    await db.conversionEvents.update(r.id, { status: "pending", attempts: 0, reason: undefined, updatedAt: now.toISOString() });
    await audit(db, actor, { action: "conversion.retry", resourceType: "conversion_event", resourceId: r.id, leadId: r.leadId, detail: { provider: r.provider, type: r.type }, at: now });
  }
  return rows.length;
}
