import { NextResponse } from "next/server";
import { clearPlanSessionCookie, revokeAllPlanSessions, revokePlanSession } from "@/server/services/planAccount";
import { noStore, readBody, withPlan } from "../../shared";

/** Signs out one device ({id}) or every device ({all: true}), this one included. */
export async function POST(request: Request) {
  return withPlan(request, async (ctx) => {
    const input = (await readBody(request)) as { id?: unknown; all?: unknown } | null;
    let signedOutHere = false;
    if (input?.all === true) {
      await revokeAllPlanSessions(ctx);
      signedOutHere = true;
    } else if (typeof input?.id === "string" && /^[0-9a-f]{64}$/.test(input.id)) {
      const r = await revokePlanSession(ctx, input.id);
      if (!r.ok) return NextResponse.json({ error: "That device is already signed out." }, { status: 404, headers: noStore });
      signedOutHere = r.current;
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: noStore });
    }
    const res = NextResponse.json({ ok: true, signedOutHere }, { headers: noStore });
    if (signedOutHere) res.headers.append("set-cookie", clearPlanSessionCookie());
    return res;
  });
}
