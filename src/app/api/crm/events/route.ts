import { NextResponse } from "next/server";
import { applyCrmEvent, parseCrmEvent, verifyCrmEvent } from "@/server/crm/events";
import { getDb } from "@/server/runtime";

/**
 * Unsubscribe, bounce and complaint events from the CRM. Headers: x-timestamp (unix seconds) and
 * x-signature (hex HMAC-SHA256 of `${timestamp}.${body}` with CRM_WEBHOOK_SECRET). Requests outside a
 * 5 minute window are rejected as replays. Without the secret every request is refused.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyCrmEvent(raw, request.headers.get("x-signature"), request.headers.get("x-timestamp"), process.env.CRM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ev = parseCrmEvent(raw);
  if (!ev) return NextResponse.json({ ok: true, ignored: true });
  await applyCrmEvent(await getDb(), ev);
  return NextResponse.json({ ok: true, type: ev.type, channel: ev.channel });
}
