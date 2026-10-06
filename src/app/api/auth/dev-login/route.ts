import { NextResponse } from "next/server";
import { devLoginEnabled, issueSession, sessionCookie } from "@/server/auth/session";
import { audit } from "@/server/audit/log";
import { getDb } from "@/server/runtime";

/** Development-only sign-in as any seeded user. Returns 404 unless ENABLE_DEV_LOGIN=true outside production. */
export async function POST(request: Request) {
  if (!devLoginEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const userId = String(form?.get("userId") ?? "");
  const db = getDb();
  const user = db.users.get(userId);
  if (!user || !user.active) return NextResponse.json({ error: "Unknown user" }, { status: 400 });
  audit(db, { userId: user.id, role: user.role }, { action: "auth.dev_login", resourceType: "user", resourceId: user.id });
  const target = user.role === "platform_admin" ? "/admin/fees" : "/portal";
  const res = NextResponse.redirect(new URL(target, request.url), 303);
  res.headers.append("set-cookie", sessionCookie(issueSession(user.id, true)));
  return res;
}
