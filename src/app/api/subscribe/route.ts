import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildConsentRecord } from "@/lib/consent";
import { postToCrm } from "@/lib/crm";
import { subscribeSchema } from "@/lib/subscribe";

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

  const smsConsent = input.smsConsent && Boolean(input.phone);
  const record = {
    id: randomUUID(),
    type: "subscriber" as const,
    receivedAt: new Date().toISOString(),
    kind: input.kind,
    interest: input.interest,
    contact: { email: input.email, firstName: input.firstName, phone: input.phone || undefined, state: input.state },
    message: input.message,
    details: input.details,
    consent: buildConsentRecord({
      smsConsent,
      acknowledgedNoRelationship: false,
      pageUrl: input.pageUrl ?? request.headers.get("referer") ?? "",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
    }),
  };

  try {
    const result = await postToCrm(record, { id: record.id, kind: input.kind, interest: input.interest });
    if (result.target === "webhook" && !result.delivered) throw new Error(`webhook status ${result.status}`);
  } catch (err) {
    console.error("subscriber delivery failed", { id: record.id, error: String(err) });
    return NextResponse.json({ error: "We could not save that. Please try again or call us." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
