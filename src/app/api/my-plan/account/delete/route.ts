import { NextResponse } from "next/server";
import { clearPlanSessionCookie, deletePlanAccount } from "@/server/services/planAccount";
import { codeError, noStore, readCode, withPlan } from "../../shared";

/** "Delete my account": a fresh code, then the account, plan, answers, second factor and every session go for good. */
export async function POST(request: Request) {
  return withPlan(request, async (ctx) => {
    const r = await deletePlanAccount(ctx, await readCode(request));
    if (!r.ok) return codeError(r);
    const res = NextResponse.json({ ok: true, deleted: true }, { headers: noStore });
    res.headers.append("set-cookie", clearPlanSessionCookie());
    return res;
  });
}
