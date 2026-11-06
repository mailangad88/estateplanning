/**
 * Instant "new website lead" email to the firm, sent while the visitor's request is still open.
 *
 * Why: staff alerts otherwise come only from the /api/cron/sweep SLA job, which needs a scheduler and
 * OUTBOUND_SEND_MODE=live (which also turns on client emails). Speed to lead decides whether a form
 * lead books, so the firm hears about every lead within seconds, whatever the scheduler is doing.
 *
 * The alert goes to the firm's own inbox (LEAD_ALERT_EMAIL), never to the visitor, so it does not wait
 * for client-email approval. Like every staff notification it carries no names, contact details or case
 * facts: only how hot the lead is, how they asked to be contacted, where they came from and a portal link.
 */
import type { LeadRecord } from "@/lib/crm";
import { emailTransportFromEnv, type EmailTransport } from "@/server/notify/transports";

type Env = Record<string, string | undefined>;

/** Addresses from LEAD_ALERT_EMAIL (comma separated). Empty when unset. */
export function leadAlertRecipients(env: Env = process.env): string[] {
  return (env.LEAD_ALERT_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

/** The email transport for staff alerts, or null when no provider is configured. Ignores OUTBOUND_SEND_MODE. */
export function leadAlertTransport(env: Env = process.env, fetchImpl: typeof fetch = fetch): EmailTransport | null {
  try {
    return emailTransportFromEnv({ ...env, OUTBOUND_SEND_MODE: "live" }, fetchImpl);
  } catch {
    return null;
  }
}

const TIER_LABEL: Record<string, string> = { hot: "HOT", warm: "Warm", not_a_fit: "Out of area" };

/** Subject and body of the alert. Exported for tests: it must never contain the visitor's personal details. */
export function leadAlertMessage(record: LeadRecord, appUrl: string): { subject: string; text: string } {
  const tier = TIER_LABEL[record.score.tier] ?? record.score.tier;
  const how = record.contactMethod === "phone" ? "call" : record.contactMethod === "text" ? "text" : "email";
  const page = (record.source.landingPage ?? "").replace(/^https?:\/\/[^/]+/, "").split("?")[0] || "unknown page";
  const base = appUrl.replace(/\/$/, "");
  const subject = `${tier} website lead: wants a ${how}${record.score.urgent ? " (urgent)" : ""}`;
  const text = [
    `A new lead came in through the website at ${record.receivedAt}.`,
    "",
    `How hot: ${tier}${record.score.grade ? ` (grade ${record.score.grade})` : ""}${record.score.urgent ? ", marked urgent" : ""}`,
    `Asked for: a ${how}`,
    `Came in through: ${record.capture.tool}${record.capture.resource ? ` (${record.capture.resource})` : ""}`,
    `First page: ${page}`,
    `Source: ${record.source.utmSource ?? record.source.referrer ?? "direct"}`,
    "",
    "Reply within 5 minutes if you can. Leads called back fast are far more likely to book.",
    `Open the intake queue: ${base}/portal/queue`,
    "",
    `Lead id: ${record.id}`,
  ].join("\n");
  return { subject, text };
}

/** Sends the alert. Never throws: a failed alert must not fail the visitor's request. */
export async function sendLeadAlert(
  record: LeadRecord,
  env: Env = process.env,
  transport: EmailTransport | null = leadAlertTransport(env),
): Promise<{ sent: number; skipped?: string }> {
  const to = leadAlertRecipients(env);
  if (to.length === 0) return { sent: 0, skipped: "LEAD_ALERT_EMAIL not set" };
  if (!transport) return { sent: 0, skipped: "no email provider configured" };
  const { subject, text } = leadAlertMessage(record, env.APP_URL ?? env.NEXT_PUBLIC_SITE_URL ?? "https://familyfutureplanning.com");
  let sent = 0;
  for (const addr of to) {
    try {
      await transport.send({ to: addr, subject, text, stream: "transactional", tag: "lead-alert" });
      sent++;
    } catch (err) {
      console.error("lead alert failed", { id: record.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { sent };
}
