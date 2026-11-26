import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildConsentRecord } from "@/lib/consent";
import { postToCrm } from "@/lib/crm";
import { subscribeSchema } from "@/lib/subscribe";
import { CONTACT_KINDS, contactLeadRecord } from "@/server/contactLead";
import { sendLeadAlert } from "@/server/leadAlert";
import { getDb } from "@/server/runtime";
import { ingestLead } from "@/server/services/leads";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = subscribeSchema.safeParse(json);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    return NextResponse.json({ error: "Please check the highlighted fields", fields }, { status: 422 });
  }
  const input = parsed.data;
  if (input.website) return NextResponse.json({ ok: true });

  const now = new Date();
  const smsConsent = input.smsConsent && Boolean(input.phone);
  const pageUrl = input.pageUrl ?? request.headers.get("referer") ?? "";
  const consent = buildConsentRecord({
    smsConsent,
    acknowledgedNoRelationship: false,
    pageUrl,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
    now,
  });
  const record = {
    id: randomUUID(),
    type: "subscriber" as const,
    receivedAt: now.toISOString(),
    kind: input.kind,
    interest: input.interest,
    contact: { email: input.email, firstName: input.firstName, phone: input.phone || undefined, state: input.state },
    message: input.message,
    details: input.details,
    consent,
  };

  // Call-backs and questions also go to the intake queue and the firm's alert inbox.
  let stored = false;
  const lead = CONTACT_KINDS.has(input.kind) ? contactLeadRecord(input, record.id, now, consent, pageUrl) : null;
  if (lead && process.env.PORTAL_INGEST_LEADS === "true") {
    try {
      await ingestLead(await getDb(), lead, now);
      stored = true;
    } catch (err) {
      console.error("portal ingest failed", { id: record.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    const result = await postToCrm(record, { id: record.id, kind: input.kind, interest: input.interest });
    if (result.target === "webhook" && !result.delivered && !stored) throw new Error(`webhook status ${result.status}`);
  } catch (err) {
    console.error("subscriber delivery failed", { id: record.id, error: String(err) });
    if (!stored) return NextResponse.json({ error: "We could not save that. Please try again or call us." }, { status: 502 });
  }

  // Tell the firm right away (generic alert, no personal details). Never fails the request.
  if (lead) await sendLeadAlert(lead);

  return NextResponse.json({ ok: true });
}
