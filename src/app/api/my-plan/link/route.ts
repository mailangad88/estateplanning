import { NextResponse } from "next/server";
import { getDb } from "@/server/runtime";
import { completePlanSignIn, planSessionCookie } from "@/server/services/familyPlan";
import { planError } from "../shared";

/** The emailed link: opens a plan session and returns to /my-plan, where the device draft is saved. */
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
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
