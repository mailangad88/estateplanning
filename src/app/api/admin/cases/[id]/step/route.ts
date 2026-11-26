import { NextResponse } from "next/server";
import { withActor } from "@/server/http";
import { updateCaseStep, type StepAction } from "@/server/services/caseBoard";

const ACTIONS: StepAction[] = ["done", "skip", "undo"];

/**
 * POST (form or JSON) { step, action: "done" | "skip" | "undo", note? }: tick off the step the case is on,
 * mark it not needed, or undo the last legal step. A form post returns to the case journey page.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isForm = (request.headers.get("content-type") ?? "").includes("form");
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/cases/${encodeURIComponent(id)}?${q}`, request.url), 303);
  const res = await withActor(request, async ({ db, actor, request }) => {
    const body = isForm ? Object.fromEntries(await request.formData()) : await request.json().catch(() => ({}));
    const action = String(body.action ?? "done") as StepAction;
    if (!ACTIONS.includes(action)) throw new Error("action must be done, skip or undo");
    const lead = await updateCaseStep(db, actor, id, String(body.step ?? ""), action, body.note ? String(body.note) : undefined);
    return isForm ? back(`updated=${encodeURIComponent(String(body.step))}`) : { ok: true, stage: lead.stage, caseSteps: lead.caseSteps ?? {} };
  });
  if (isForm && res.status >= 400) {
    const err = (await res.clone().json().catch(() => ({}))) as { error?: string };
    return back(`error=${encodeURIComponent(err.error ?? "Something went wrong")}`);
  }
  return res;
}
