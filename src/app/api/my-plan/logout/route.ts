import { NextResponse } from "next/server";
import { cookieFromHeader } from "@/server/auth/session";
import { getDb } from "@/server/runtime";
import { clearPlanSessionCookie, PLAN_SESSION_COOKIE, resolvePlanSession, signOutPlanSession } from "@/server/services/planAccount";

/** Signs out on this device: the session record is removed, so the cookie stops working everywhere. */
export async function POST(request: Request) {
  try {
    const ctx = await resolvePlanSession(await getDb(), cookieFromHeader(request.headers.get("cookie"), PLAN_SESSION_COOKIE), new Date(), { touch: false });
    if (ctx) await signOutPlanSession(ctx);
  } catch (err) {
    console.error("family plan sign-out failed", err instanceof Error ? err.message : "unknown error");
  }
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.headers.append("set-cookie", clearPlanSessionCookie());
  return res;
}
