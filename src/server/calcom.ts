import { createHmac, timingSafeEqual } from "node:crypto";

/** Pure helpers for Cal.com webhooks: signature check and payload parsing. No db, no network. */

export const CALCOM_EVENTS = ["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"] as const;
export type CalcomEvent = (typeof CALCOM_EVENTS)[number];

/** Cal.com sends the hex HMAC-SHA256 of the raw body in X-Cal-Signature-256. Fails closed without a secret. */
export function verifyCalcomSignature(raw: string, signature: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const given = Buffer.from(signature.trim(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface CalcomBooking {
  event: CalcomEvent;
  /** Lead id passed to the embed as metadata[leadRef], when present */
  leadRef?: string;
  /** Lowercased attendee emails */
  emails: string[];
}

/** Returns null for events this site does not act on or payloads without a usable shape. */
export function parseCalcomPayload(raw: string): CalcomBooking | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const b = body as { triggerEvent?: unknown; payload?: unknown };
  if (!CALCOM_EVENTS.includes(b.triggerEvent as CalcomEvent)) return null;
  const p = (b.payload && typeof b.payload === "object" ? b.payload : {}) as {
    metadata?: Record<string, unknown>;
    attendees?: { email?: unknown }[];
  };
  const ref = p.metadata?.leadRef;
  const emails = (Array.isArray(p.attendees) ? p.attendees : [])
    .map((a) => (typeof a?.email === "string" ? a.email.trim().toLowerCase() : ""))
    .filter(Boolean);
  return { event: b.triggerEvent as CalcomEvent, leadRef: typeof ref === "string" && ref ? ref : undefined, emails };
}

export interface LeadLike {
  id: string;
  personId: string;
  createdAt: string;
  exit?: unknown;
}

/** Newest open lead of a person, or undefined. */
export function pickLead<T extends LeadLike>(leads: T[]): T | undefined {
  return [...leads].filter((l) => !l.exit).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
