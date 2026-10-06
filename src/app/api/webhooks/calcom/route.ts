import { NextResponse } from "next/server";
import { parseCalcomPayload, pickLead, verifyCalcomSignature } from "@/server/calcom";
import { setStage } from "@/server/services/leads";
import { getDb } from "@/server/runtime";

/**
 * Cal.com booking webhooks. A booked or rescheduled consult moves the lead to "consult_booked".
 * A cancellation is acknowledged and logged but leaves the stage alone, so intake can follow up.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyCalcomSignature(raw, request.headers.get("x-cal-signature-256"), process.env.CALCOM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const booking = parseCalcomPayload(raw);
  if (!booking) return NextResponse.json({ ok: true, ignored: true });

  const db = await getDb();
  let lead = booking.leadRef ? await db.leads.get(booking.leadRef) : undefined;
  if (!lead) {
    const people = await db.persons.list((p) => booking.emails.includes(p.email.trim().toLowerCase()));
    const ids = new Set(people.map((p) => p.id));
    lead = pickLead(await db.leads.list((l) => ids.has(l.personId)));
  }
  if (!lead) {
    console.warn("calcom webhook: no matching lead", { event: booking.event });
    return NextResponse.json({ ok: true, matched: false });
  }
  if (booking.event === "BOOKING_CANCELLED") {
    console.info("calcom webhook: consult cancelled", { leadId: lead.id });
    return NextResponse.json({ ok: true, matched: true, event: booking.event });
  }
  await setStage(db, "system", lead.id, "consult_booked");
  return NextResponse.json({ ok: true, matched: true, event: booking.event });
}
