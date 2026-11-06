import { NextResponse } from "next/server";
import { parseBrevoEvents, verifyBrevoWebhook } from "@/server/crm/brevoEvents";
import { applyCrmEvent } from "@/server/crm/events";
import { getDb } from "@/server/runtime";

/**
 * Brevo unsubscribe, hard bounce and spam events. Auth: `Authorization: Bearer <BREVO_WEBHOOK_SECRET>`
 * or `?token=<BREVO_WEBHOOK_SECRET>`. Each event is recorded as a local suppression, which our sender
 * and the next Brevo sync both honour.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!verifyBrevoWebhook(request.headers.get("authorization"), url.searchParams.get("token"), process.env.BREVO_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const events = parseBrevoEvents(await request.text());
  if (events.length === 0) return NextResponse.json({ ok: true, ignored: true });
  const db = await getDb();
  for (const ev of events) await applyCrmEvent(db, ev);
  return NextResponse.json({ ok: true, applied: events.length });
}
