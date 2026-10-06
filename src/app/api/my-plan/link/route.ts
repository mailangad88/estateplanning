import { NextResponse } from "next/server";
import { getDb } from "@/server/runtime";
import { completePlanSignIn, planSessionCookie } from "@/server/services/familyPlan";
import { planError } from "../shared";

/**
 * Opening a link never uses it up: email scanners and link previews fetch with GET, so a GET only
 * sends the visitor to the confirm page (/my-plan/open), whose button POSTs here.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const res = NextResponse.redirect(new URL(`/my-plan/open?token=${encodeURIComponent(token)}`, request.url), 303);
  res.headers.set("referrer-policy", "no-referrer");
  return res;
}

/** The confirm page's "Open my plan" button: uses the link once, opens a plan session and returns to /my-plan. */
export async function POST(request: Request) {
  try {
    const form = await request.formData().catch(() => null);
    const token = String(form?.get("token") ?? "");
    const done = await completePlanSignIn(await getDb(), token);
    if (!done) return NextResponse.redirect(new URL("/my-plan?link=expired", request.url), 303);
    const res = NextResponse.redirect(new URL(`/my-plan?saved=${done.created ? "new" : "back"}`, request.url), 303);
    res.headers.append("set-cookie", planSessionCookie(done.sessionToken));
    res.headers.set("referrer-policy", "no-referrer");
    return res;
  } catch (err) {
    return planError(err);
  }
}
