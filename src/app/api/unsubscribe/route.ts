import { NextResponse } from "next/server";
import { getDb } from "@/server/runtime";
import { unsubscribeWithToken } from "@/server/nurture/unsubscribe";

/**
 * One-click unsubscribe (RFC 8058 List-Unsubscribe-Post) and the form on /unsubscribe.
 * The token is signed per person and channel, so no login is needed and nothing else can be changed.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("t");
  if (!token) {
    const form = await request.formData().catch(() => null);
    token = form ? String(form.get("t") ?? "") : null;
  }
  const ok = await unsubscribeWithToken(await getDb(), token);
  if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") && !url.searchParams.has("t")) {
    return NextResponse.redirect(new URL(ok ? "/unsubscribe?done=1" : "/unsubscribe?invalid=1", request.url), 303);
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
