/**
 * Bounce and complaint intake for Resend (POST /api/email/events). Resend signs webhooks with Svix:
 * headers svix-id, svix-timestamp (unix seconds), svix-signature (space-delimited "v1,<base64>" entries);
 * signature = base64(HMAC-SHA256(key, `${id}.${timestamp}.${rawBody}`)) where key is the base64-decoded
 * part of the secret after "whsec_". Verified against the Svix manual-verification docs and test vector.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { audit } from "@/server/audit/log";
import type { Db } from "@/server/db";
import { normalizeAddress, putSuppression } from "@/server/nurture/compliance";

export const SVIX_TOLERANCE_MS = 5 * 60_000;

export function svixSignature(secret: string, id: string, timestamp: string, raw: string): string {
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest("base64");
}

/** Fails closed on a missing secret/header, bad or stale timestamp, or no matching v1 signature. */
export function verifySvix(
  raw: string,
  h: { id?: string | null; timestamp?: string | null; signature?: string | null },
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!secret || !h.id || !h.timestamp || !h.signature || !/^\d{9,13}$/.test(h.timestamp)) return false;
  if (Math.abs(now - Number(h.timestamp) * 1000) > SVIX_TOLERANCE_MS) return false;
  const expected = Buffer.from(svixSignature(secret, h.id, h.timestamp, raw), "base64");
  let ok = false;
  for (const part of h.signature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const given = Buffer.from(sig, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) ok = true;
  }
  return ok;
}

export interface EmailEvent {
  type: "bounce" | "complaint";
  addresses: string[];
}

/** Hard (Permanent) bounces and complaints only. Transient and undetermined bounces are retried by the provider. */
export function parseEmailEvent(raw: string): EmailEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const b = body as { type?: unknown; data?: { to?: unknown; bounce?: { type?: unknown } } };
  const to = b.data?.to;
  const addresses = (Array.isArray(to) ? to : typeof to === "string" ? [to] : []).filter((a): a is string => typeof a === "string" && a.includes("@"));
  if (!addresses.length) return null;
  if (b.type === "email.complained") return { type: "complaint", addresses };
  if (b.type === "email.bounced" && String(b.data?.bounce?.type ?? "").toLowerCase() === "permanent") return { type: "bounce", addresses };
  return null;
}

export async function applyEmailEvent(db: Db, ev: EmailEvent, now = new Date()): Promise<void> {
  for (const a of ev.addresses) await putSuppression(db, "email", normalizeAddress("email", a), `resend:${ev.type}`, now);
  await audit(db, "system", { action: "email.event", resourceType: "suppression", resourceId: `email:${ev.type}`, detail: { type: ev.type, count: ev.addresses.length }, at: now });
}
