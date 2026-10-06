import { NextResponse } from "next/server";
import { clearPlanSessionCookie, deleteOwnPlan, loadOwnPlan, saveOwnPlan } from "@/server/services/familyPlan";
import { noStore, readBody, withPlan } from "./shared";

/** The signed-in visitor's own plan. */
export async function GET(request: Request) {
  return withPlan(request, async ({ planId, db }) => {
    const plan = await loadOwnPlan(db, planId);
    if (!plan) {
      const res = NextResponse.json({ error: "This plan no longer exists" }, { status: 404, headers: noStore });
      res.headers.append("set-cookie", clearPlanSessionCookie());
      return res;
    }
    return NextResponse.json({ plan }, { headers: noStore });
  });
}

/** Saves the whole plan. Validation rejects anything that looks like an account number, SSN or similar. */
export async function PUT(request: Request) {
  return withPlan(request, async ({ planId, db }) => {
    const input = (await readBody(request)) as { body?: unknown } | null;
    const result = await saveOwnPlan(db, planId, input?.body);
    if (!result.ok) {
      const status = "notFound" in result ? 404 : 422;
      return NextResponse.json({ error: result.error, fields: result.fields }, { status, headers: noStore });
    }
    return NextResponse.json({ plan: result.plan }, { headers: noStore });
  });
}

/** "Delete my data": removes the plan for good and ends the plan session. */
export async function DELETE(request: Request) {
  return withPlan(request, async ({ planId, db }) => {
    await deleteOwnPlan(db, planId);
    const res = NextResponse.json({ ok: true, deleted: true }, { headers: noStore });
    res.headers.append("set-cookie", clearPlanSessionCookie());
    return res;
  });
}
