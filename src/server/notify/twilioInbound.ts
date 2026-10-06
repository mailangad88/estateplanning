/**
 * Inbound SMS from Twilio (POST /api/sms/inbound). X-Twilio-Signature = base64(HMAC-SHA1(authToken,
 * fullUrl + each POST param name+value, params sorted by name)). Twilio's messaging service answers HELP
 * itself, so HELP is a no-op here; STOP-type keywords suppress the number, START-type keywords lift it.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { audit } from "@/server/audit/log";
import type { Db } from "@/server/db";
import { maskAddress } from "@/server/notify/transports";
import { normalizeAddress, putSuppression } from "@/server/nurture/compliance";

export function twilioSignature(authToken: string, url: string, params: URLSearchParams): string {
  const keys = [...new Set([...params.keys()])].sort();
  let data = url;
  for (const k of keys) for (const v of params.getAll(k)) data += k + v;
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function verifyTwilio(url: string, params: URLSearchParams, signature: string | null | undefined, authToken: string | undefined): boolean {
  if (!authToken || !signature) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(signature.trim());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);

export type SmsKeyword = "stop" | "start" | "help" | "other";

export function smsKeyword(body: string): SmsKeyword {
  const w = body.trim().toLowerCase();
  if (STOP_WORDS.has(w)) return "stop";
  if (w === "start" || w === "unstop") return "start";
  if (w === "help") return "help";
  return "other";
}

export async function applySmsInbound(db: Db, from: string, body: string, now = new Date()): Promise<SmsKeyword> {
  const kw = smsKeyword(body);
  if (kw === "other" || kw === "help" || !from.trim()) return kw;
  const addr = normalizeAddress("sms", from);
  if (kw === "stop") {
    await putSuppression(db, "sms", addr, `opt_out:${body.trim().slice(0, 40)}`, now);
  } else {
    await db.suppressions.remove(`sms:${addr}`);
  }
  await audit(db, "system", { action: kw === "stop" ? "sms.opt_out" : "sms.opt_in", resourceType: "suppression", resourceId: `sms:${maskAddress(from)}`, detail: { keyword: kw }, at: now });
  return kw;
}
