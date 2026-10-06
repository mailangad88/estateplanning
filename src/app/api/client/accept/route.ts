import { NextResponse } from "next/server";
import { sessionCookie } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { getDb } from "@/server/runtime";
import { acceptInvite } from "@/server/services/clientPortal";

/** Form POST from /client/welcome. Single-use token in, session cookie out. */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "");
    const { session, mfa } = await acceptInvite(await getDb(), token);
    // Production: mfa is false, so the client continues through the two-step verify flow.
    // TODO: wire to /portal/login/verify (src/server/auth/flow.ts) once it exists.
    const res = NextResponse.redirect(new URL(mfa ? "/client" : "/portal/login/verify", request.url), 303);
    res.headers.append("set-cookie", sessionCookie(session));
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
