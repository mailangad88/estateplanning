/**
 * Brevo webhooks (marketing and transactional) mapped to our CRM events, so a Brevo unsubscribe,
 * hard bounce or spam complaint becomes a local suppression through applyCrmEvent.
 *
 * Brevo does not sign webhooks with an HMAC. The webhook is created with bearer auth
 * (`auth: { type: "bearer", token }` in the Brevo API, or a custom Authorization header in the UI), or
 * with `?token=` on the URL; either must equal BREVO_WEBHOOK_SECRET. No secret means every request is refused.
 */
import { timingSafeEqual } from "node:crypto";
import type { CrmEvent, CrmEventType } from "@/server/crm/events";

/** Brevo event names (marketing uses camelCase, transactional snake_case) to ours. Others are ignored. */
const EVENT_MAP: Record<string, CrmEventType> = {
  unsubscribe: "unsubscribe",
  unsubscribed: "unsubscribe",
  hardbounce: "bounce",
  hard_bounce: "bounce",
  spam: "complaint",
  complaint: "complaint",
};

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function verifyBrevoWebhook(authorization: string | null, queryToken: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return (!!bearer && same(bearer, secret)) || (!!queryToken && same(queryToken, secret));
}

/** One event or a batch (array). Returns the email events we act on; unknown events and malformed items are dropped. */
export function parseBrevoEvents(raw: string): CrmEvent[] {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return [];
  }
  const items = Array.isArray(body) ? body : [body];
  const out: CrmEvent[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const type = typeof b.event === "string" ? EVENT_MAP[b.event.toLowerCase()] : undefined;
    const email = typeof b.email === "string" ? b.email.trim() : "";
    if (type && email.includes("@")) out.push({ type, channel: "email", address: email });
  }
  return out;
}
