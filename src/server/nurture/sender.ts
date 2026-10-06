/**
 * Nurture sender: the piece that actually works through due sequence steps.
 * Before this, the scheduler worked out what was due (dueSends) and how to record
 * a send (markSent), but nothing called either, so follow-ups were scheduled and
 * never went out. The cron sweep now calls runNurtureSends every minute.
 *
 * For each due step:
 * - call_task: the call task is created for intake (no message leaves the firm).
 * - email / sms: the attorney-approved template is rendered; with no approved
 *   template the step waits. In dry-run mode (the default) the message is logged
 *   and the step stays due, so nothing is lost when sending goes live. In live
 *   mode it goes through the transport and is recorded with markSent.
 *
 * Compliance gates (consent, suppressions, quiet hours, frequency caps, review
 * guards) live in evaluateSends and run before anything reaches this file.
 */
import { signToken } from "@/server/auth/identity";
import { firm } from "@/config/firm";
import type { Db } from "@/server/db";
import type { EmailTransport, SmsTransport } from "@/server/notify/transports";
import { evaluateSends, markSent, type DueSend } from "@/server/nurture/scheduler";
import { getSequence } from "@/server/nurture/sequences";
import type { Lawyer, Lead, Person } from "@/server/types";

export interface TemplateVars {
  firstName: string;
  firmName: string;
  attorneyName?: string;
  bookingUrl?: string;
  unsubscribeUrl: string;
  resourceUrl?: string;
  reviewUrl?: string;
  portalUrl?: string;
}

export interface RenderedMessage {
  subject?: string;
  text: string;
  html?: string;
  templateKey: string;
  templateVersion: string;
}

/** Returns null unless the template's current version is attorney-approved. */
export interface TemplateSource {
  render(db: Db, templateKey: string, channel: "email" | "sms", vars: TemplateVars): Promise<RenderedMessage | null>;
}

/** Nothing approved: every message step waits. The safe default until templates are approved. */
export const NO_APPROVED_TEMPLATES: TemplateSource = { render: async () => null };

export interface SenderDeps {
  templates: TemplateSource;
  email: EmailTransport;
  sms: SmsTransport;
  /** Public site origin for links, e.g. https://www.example.com */
  baseUrl?: string;
  /** Cap per run so one sweep cannot flood a provider */
  limit?: number;
}

export interface SenderResult {
  due: number;
  deferred: number;
  sent: number;
  callTasks: number;
  /** Rendered and logged only (dry-run transport); left due for when sending goes live */
  dryRun: number;
  /** No approved template yet; left due */
  awaitingTemplate: number;
  failed: number;
  /** Template keys still waiting for approval, so the attorney knows what blocks follow-ups */
  missingTemplates: string[];
}

const UNSUB_PURPOSE = "unsubscribe";

export interface UnsubscribePayload {
  /** person id */
  p: string;
  /** channel to stop; "email" from emails */
  c: "email" | "sms";
}

export function unsubscribeToken(personId: string, channel: "email" | "sms" = "email"): string {
  return signToken(UNSUB_PURPOSE, { p: personId, c: channel } satisfies UnsubscribePayload);
}

export function unsubscribeUrl(baseUrl: string, personId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/unsubscribe?t=${encodeURIComponent(unsubscribeToken(personId))}`;
}

export { UNSUB_PURPOSE };

function varsFor(baseUrl: string, person: Person, lawyer: Lawyer | undefined): TemplateVars {
  const base = baseUrl.replace(/\/$/, "");
  return {
    firstName: person.firstName || "there",
    firmName: firm.brandName,
    attorneyName: lawyer?.name ?? firm.attorneyName,
    bookingUrl: firm.schedulerUrl ?? `${base}/contact`,
    unsubscribeUrl: unsubscribeUrl(base, person.id),
    portalUrl: `${base}/client`,
  };
}

async function consultLookup(db: Db): Promise<(leadId: string) => string | undefined> {
  const next = new Map<string, string>();
  for (const c of await db.consults.list((x) => x.status === "booked")) {
    const prev = next.get(c.leadId);
    if (!prev || c.at < prev) next.set(c.leadId, c.at);
  }
  return (leadId) => next.get(leadId);
}

export async function runNurtureSends(db: Db, deps: SenderDeps, now = new Date()): Promise<SenderResult> {
  const { due, deferred } = await evaluateSends(db, now, { consultAt: await consultLookup(db) });
  const result: SenderResult = { due: due.length, deferred: deferred.length, sent: 0, callTasks: 0, dryRun: 0, awaitingTemplate: 0, failed: 0, missingTemplates: [] };
  const missing = new Set<string>();
  const baseUrl = deps.baseUrl ?? process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const leads = new Map<string, Lead | undefined>();
  let attempted = 0;

  for (const d of due) {
    if (deps.limit !== undefined && attempted >= deps.limit) break;
    if (d.channel === "call_task") {
      await markSent(db, d.enrollmentId, d.stepId, now);
      result.callTasks++;
      continue;
    }
    if (!leads.has(d.leadId)) leads.set(d.leadId, await db.leads.get(d.leadId));
    const lead = leads.get(d.leadId);
    const person = lead ? await db.persons.get(lead.personId) : undefined;
    if (!lead || !person) continue;
    const lawyer = lead.assignedLawyerId ? await db.lawyers.get(lead.assignedLawyerId) : undefined;
    const msg = await deps.templates.render(db, d.templateKey, d.channel, varsFor(baseUrl, person, lawyer));
    if (!msg) {
      result.awaitingTemplate++;
      missing.add(d.templateKey);
      continue;
    }
    attempted++;
    try {
      if (d.channel === "email") {
        if (!person.email) continue;
        const unsub = unsubscribeUrl(baseUrl, person.id);
        const r = await deps.email.send({
          to: person.email,
          subject: msg.subject ?? firm.brandName,
          text: msg.text,
          html: msg.html,
          tag: d.templateKey,
          stream: (await isTransactional(db, d)) ? "transactional" : "marketing",
          // RFC 8058 one-click unsubscribe, which Gmail and Yahoo require of bulk senders.
          headers: { "List-Unsubscribe": `<${unsub.replace("/unsubscribe?", "/api/unsubscribe?")}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        });
        if (r.dryRun) {
          result.dryRun++;
          continue;
        }
      } else {
        if (!person.phone) continue;
        const r = await deps.sms.send({ to: person.phone, body: msg.text, tag: d.templateKey });
        if (r.dryRun) {
          result.dryRun++;
          continue;
        }
      }
      await markSent(db, d.enrollmentId, d.stepId, now);
      result.sent++;
    } catch (err) {
      result.failed++;
      // No address or body in the log line.
      console.error("nurture send failed", { leadId: d.leadId, stepId: d.stepId, channel: d.channel, error: err instanceof Error ? err.message : String(err) });
    }
  }
  result.missingTemplates = [...missing].sort();
  return result;
}

/** Service messages (confirmations, reminders) use the transactional stream; everything else is marketing. */
async function isTransactional(db: Db, d: DueSend): Promise<boolean> {
  const enr = await db.enrollments.get(d.enrollmentId);
  return !!getSequence(enr?.sequenceId ?? "")?.steps.find((s) => s.id === d.stepId)?.transactional;
}
