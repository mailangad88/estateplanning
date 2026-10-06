import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { servedStates } from "@/config/firm";
import { buildConsentRecord } from "@/lib/consent";
import { deliverLead, type LeadRecord } from "@/lib/crm";
import { effectiveContactMethod, leadSubmissionSchema } from "@/lib/lead";
import { educationTopics } from "@/lib/quiz";
import { captureTags, heardFromTags, scoreLead, segmentTags } from "@/lib/scoring";
import { getDb } from "@/server/runtime";
import { ingestLead } from "@/server/services/leads";
import { getMagnet } from "@/lib/magnets";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = leadSubmissionSchema.safeParse(json);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    return NextResponse.json({ error: "Please check the highlighted fields", fields }, { status: 422 });
  }
  const lead = parsed.data;

  // Honeypot filled: answer like a success so bots learn nothing, but drop the lead.
  if (lead.website) return NextResponse.json({ ok: true, served: true, topics: [] });

  const guide = lead.capture.resource ? getMagnet(lead.capture.resource) : undefined;
  if (lead.capture.tool === "guide" && !guide) {
    return NextResponse.json({ error: "That guide could not be found" }, { status: 422 });
  }

  const now = new Date();
  const record: LeadRecord = {
    id: randomUUID(),
    receivedAt: now.toISOString(),
    contact: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      state: lead.state,
      county: lead.county,
      language: lead.language,
    },
    contactMethod: effectiveContactMethod(lead),
    goals: lead.goals,
    answers: lead.answers,
    score: scoreLead({
      state: lead.state,
      servedStates: servedStates(),
      answers: lead.answers,
      goals: lead.goals,
      smsConsent: lead.smsConsent,
      capture: lead.capture,
      priorTools: lead.priorTools,
    }),
    segments: [...new Set([...segmentTags(lead.answers), ...captureTags(lead.capture), ...heardFromTags(lead.source)])],
    source: lead.source,
    heardFrom: lead.source.heardFrom,
    capture: lead.capture,
    visitorId: lead.visitorId,
    priorTools: lead.priorTools,
    consent: buildConsentRecord({
      smsConsent: lead.smsConsent,
      acknowledgedNoRelationship: lead.acknowledgedNoRelationship,
      pageUrl: lead.source.landingPage ?? request.headers.get("referer") ?? "",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
      now,
    }),
  };

  let failure: string | null = null;
  try {
    const result = await deliverLead(record);
    if (result.target === "webhook" && !result.delivered) failure = `webhook status ${result.status}`;
  } catch (err) {
    failure = String(err);
  }
  if (failure) {
    console.error("lead delivery failed", { id: record.id, error: failure });
    return NextResponse.json({ error: "We could not save your request. Please call us." }, { status: 502 });
  }

  // Also hand the lead to the portal backend once it is switched on. A failure here never
  // loses the lead: the CRM delivery above has already succeeded.
  if (process.env.PORTAL_INGEST_LEADS === "true") {
    try {
      await ingestLead(await getDb(), record, now);
    } catch (err) {
      console.error("portal ingest failed", { id: record.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    served: record.score.tier !== "not_a_fit",
    topics: educationTopics(lead.answers),
    ...(guide ? { guideUrl: `/free/${guide.slug}/view` } : {}),
  });
}
