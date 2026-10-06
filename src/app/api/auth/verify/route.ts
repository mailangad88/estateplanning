import { NextResponse } from "next/server";
import { clearPreauthCookie, PREAUTH_COOKIE, verifyMfa } from "@/server/auth/flow";
import { cookieFromHeader, sessionCookie } from "@/server/auth/session";
import { getDb } from "@/server/runtime";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const code = String(form?.get("code") ?? "");
  const pre = cookieFromHeader(request.headers.get("cookie"), PREAUTH_COOKIE);
  const r = await verifyMfa(await getDb(), pre, code);
  if (!r.ok) {
    const target = r.reason === "no_preauth" ? "/portal/login?expired=1" : `/portal/login/verify?error=${r.reason}`;
    return NextResponse.redirect(new URL(target, request.url), 303);
  }
  const res = NextResponse.redirect(new URL("/portal", request.url), 303);
  res.headers.append("set-cookie", sessionCookie(r.sessionToken));
  res.headers.append("set-cookie", clearPreauthCookie());
  return res;
}
