import { NextResponse } from "next/server";
import { withActor } from "@/server/http";
import { assignParalegal } from "@/server/services/caseBoard";

/** POST (form or JSON) { paralegalId }: assign the case's paralegal. An empty value takes them off the case. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isForm = (request.headers.get("content-type") ?? "").includes("form");
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/cases/${encodeURIComponent(id)}?${q}`, request.url), 303);
  const res = await withActor(request, async ({ db, actor, request }) => {
    const body = isForm ? Object.fromEntries(await request.formData()) : await request.json().catch(() => ({}));
    const pick = String(body.paralegalId ?? "").trim() || null;
    const lead = await assignParalegal(db, actor, id, pick);
    return isForm ? back("assigned=1") : { ok: true, assignedParalegalId: lead.assignedParalegalId ?? null };
  });
  if (isForm && res.status >= 400) {
    const err = (await res.clone().json().catch(() => ({}))) as { error?: string };
    return back(`error=${encodeURIComponent(err.error ?? "Something went wrong")}`);
  }
  return res;
}
