import { NextResponse } from "next/server";
import { enrollMfa, mfaStatus, PREAUTH_COOKIE, readPreauth } from "@/server/auth/flow";
import { cookieFromHeader } from "@/server/auth/session";
import { getDb } from "@/server/runtime";

/** Setup details, only for a pre-auth session whose authenticator is not yet confirmed. */
export async function GET(request: Request) {
  const uid = readPreauth(cookieFromHeader(request.headers.get("cookie"), PREAUTH_COOKIE));
  const user = uid ? await (await getDb()).users.get(uid) : null;
  if (!uid || !user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if ((await mfaStatus(uid)) === "enrolled") return NextResponse.json({ error: "Already set up" }, { status: 409 });
  const e = await enrollMfa(uid, user.email);
  return NextResponse.json(e, { headers: { "cache-control": "no-store" } });
}
