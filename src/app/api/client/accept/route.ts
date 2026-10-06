import { NextResponse } from "next/server";
import { issuePreauth, preauthCookie } from "@/server/auth/flow";
import { sessionCookie } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { getDb } from "@/server/runtime";
import { acceptInvite } from "@/server/services/clientPortal";

/** Form POST from /client/welcome. Single-use token in, session cookie out. */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "");
    const { userId, session, mfa } = await acceptInvite(await getDb(), token);
    if (mfa) {
      const res = NextResponse.redirect(new URL("/client", request.url), 303);
      res.headers.append("set-cookie", sessionCookie(session));
      return res;
    }
    // Production: the invite link is the first factor only. The client sets up or enters
    // their authenticator code at /portal/login/verify before any session is issued.
    const res = NextResponse.redirect(new URL("/portal/login/verify", request.url), 303);
    res.headers.append("set-cookie", preauthCookie(issuePreauth(userId)));
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
