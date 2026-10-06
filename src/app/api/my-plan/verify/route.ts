import { NextResponse } from "next/server";
import { cookieFromHeader } from "@/server/auth/session";
import { getDb } from "@/server/runtime";
import { clearPlanPreauthCookie, PLAN_PREAUTH_COOKIE } from "@/server/services/familyPlan";
import { deviceFromRequest, planSessionCookie, verifyPlanSignIn } from "@/server/services/planAccount";
import { codeError, noStore, planError, readCode } from "../shared";

/**
 * The code step after the email link: an authenticator code (or, once set up, a recovery code). The first
 * time, the response carries the 10 recovery codes; this is the only time they are ever sent.
 */
export async function POST(request: Request) {
  try {
    const code = await readCode(request);
    const pre = cookieFromHeader(request.headers.get("cookie"), PLAN_PREAUTH_COOKIE);
    const r = await verifyPlanSignIn(await getDb(), pre, code, deviceFromRequest(request));
    if (!r.ok) {
      if (r.reason === "no_preauth" || r.reason === "no_setup") {
        return NextResponse.json({ error: "This sign-in has timed out. Ask for a new link from the organizer.", reason: r.reason }, { status: 401, headers: noStore });
      }
      return codeError(r);
    }
    const res = NextResponse.json(
      { ok: true, firstSignIn: r.firstSignIn, usedRecoveryCode: r.usedRecoveryCode, recoveryCodes: r.recoveryCodes, recoveryCodesLeft: r.recoveryCodesLeft },
      { headers: noStore },
    );
    res.headers.append("set-cookie", planSessionCookie(r.sessionToken));
    res.headers.append("set-cookie", clearPlanPreauthCookie());
    return res;
  } catch (err) {
    return planError(err);
  }
}
