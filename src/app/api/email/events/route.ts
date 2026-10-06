import { NextResponse } from "next/server";
import { applyEmailEvent, parseEmailEvent, verifySvix } from "@/server/notify/emailEvents";
import { getDb } from "@/server/runtime";

/** Resend (Svix-signed) bounce and complaint webhook. Needs RESEND_WEBHOOK_SECRET; without it every request is refused. */
export async function POST(request: Request) {
  const raw = await request.text();
  const h = request.headers;
  if (!verifySvix(raw, { id: h.get("svix-id"), timestamp: h.get("svix-timestamp"), signature: h.get("svix-signature") }, process.env.RESEND_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ev = parseEmailEvent(raw);
  if (!ev) return NextResponse.json({ ok: true, ignored: true });
  await applyEmailEvent(await getDb(), ev);
  return NextResponse.json({ ok: true, type: ev.type });
}
