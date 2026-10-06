/**
 * Inbound CRM events (POST /api/crm/events): unsubscribe, bounce and complaint reported by the CRM
 * (or a relay such as n8n or a CRM workflow webhook) are recorded as local suppressions, so our own
 * sender and the CRM never disagree. Authenticated with an HMAC over `${timestamp}.${rawBody}`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { audit } from "@/server/audit/log";
import type { Db } from "@/server/db";
import { applyOptOut, normalizeAddress, putSuppression } from "@/server/nurture/compliance";

/** Requests older (or newer) than this are rejected as replays. */
export const CRM_EVENT_WINDOW_MS = 5 * 60_000;

export function signCrmEvent(raw: string, timestamp: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
}

/** Fails closed: no secret, no signature, bad timestamp, stale timestamp or a signature mismatch all return false. */
export function verifyCrmEvent(
  raw: string,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!secret || !signature || !timestamp || !/^\d{9,13}$/.test(timestamp)) return false;
  // Accept unix seconds or milliseconds.
  const ts = Number(timestamp) < 1e11 ? Number(timestamp) * 1000 : Number(timestamp);
  if (Math.abs(now - ts) > CRM_EVENT_WINDOW_MS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest();
  const given = Buffer.from(signature.trim(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type CrmEventType = "unsubscribe" | "bounce" | "complaint";

export interface CrmEvent {
  type: CrmEventType;
  channel: "email" | "sms";
  address: string;
}

const TYPES: CrmEventType[] = ["unsubscribe", "bounce", "complaint"];

/** Payload: { type, channel?: "email"|"sms", email?, phone? }. Channel defaults to sms when only a phone is given. */
export function parseCrmEvent(raw: string): CrmEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!TYPES.includes(b.type as CrmEventType)) return null;
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  const channel = b.channel === "sms" || b.channel === "email" ? b.channel : email ? "email" : "sms";
  const address = channel === "email" ? email : phone;
  if (!address) return null;
  return { type: b.type as CrmEventType, channel, address };
}

/** Records the suppression locally. Never pushes back to the CRM: it is where the event came from. */
export async function applyCrmEvent(db: Db, ev: CrmEvent, now = new Date()): Promise<void> {
  if (ev.type === "unsubscribe") {
    await applyOptOut(db, { channel: ev.channel, address: ev.address, text: ev.channel === "sms" ? "STOP" : "unsubscribe", at: now });
  } else {
    // A bounce or spam complaint ends sends to that address on that channel.
    await putSuppression(db, ev.channel, normalizeAddress(ev.channel, ev.address), `crm:${ev.type}`, now);
  }
  await audit(db, "system", { action: "crm.event", resourceType: "suppression", resourceId: `${ev.channel}:${ev.type}`, detail: { type: ev.type, channel: ev.channel }, at: now });
}
