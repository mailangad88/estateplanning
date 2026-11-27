import { NextResponse } from "next/server";
import { createManualLead } from "@/server/services/manualLead";
import { MATTER_LABELS } from "@/server/services/leads";
import { visibleLeads } from "@/server/portal/caseView";
import { withActor } from "@/server/http";

/** Leads the signed-in user can see. Open offers list only non-confidential fields. */
export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => ({
    leads: (await visibleLeads(db, actor)).map(({ lead, access }) => ({
      id: lead.id,
      access,
      matterType: MATTER_LABELS[lead.matterType],
      state: lead.state,
      urgent: lead.urgent,
      stage: lead.stage,
      summary: lead.offerSummary,
      createdAt: lead.createdAt,
    })),
  }));
}

/** POST (form) a lead entered by hand: src/server/services/manualLead.ts. Redirects to the new lead's page. */
export async function POST(request: Request) {
  const isForm = (request.headers.get("content-type") ?? "").includes("form");
  let created: string | undefined;
  const res = await withActor(request, async ({ db, actor, request: req }) => {
    const raw = isForm ? Object.fromEntries(await req.formData()) : await req.json().catch(() => ({}));
    const body = Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, typeof v === "string" ? v : String(v ?? "")]));
    const lead = await createManualLead(db, actor, body);
    created = lead.id;
    return { ok: true, id: lead.id, stage: lead.stage, assignedLawyerId: lead.assignedLawyerId ?? null, exited: !!lead.exit };
  });
  if (!isForm) return res;
  if (res.status >= 400 || !created) {
    const err = (await res.clone().json().catch(() => ({}))) as { error?: string };
    return NextResponse.redirect(new URL(`/portal/leads/new?error=${encodeURIComponent(err.error ?? "Something went wrong")}`, request.url), 303);
  }
  return NextResponse.redirect(new URL(`/portal/leads/${created}?ok=created`, request.url), 303);
}
