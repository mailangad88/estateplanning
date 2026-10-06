/**
 * Plumbing for the /api/my-plan routes. A plan session is its own cookie (ep_plan) pointing at a
 * server-side session record: it is never a portal session and reaches no portal route, and its store is
 * scoped to the one plan. It exists only after the second factor.
 */
import { NextResponse } from "next/server";
import { cookieFromHeader } from "@/server/auth/session";
import { getDb } from "@/server/runtime";
import { FamilyPlanConfigError } from "@/server/services/familyPlan";
import { clearPlanSessionCookie, PLAN_SESSION_COOKIE, resolvePlanSession, type CodeFailure, type PlanSessionContext } from "@/server/services/planAccount";

const MAX_BODY_BYTES = 64 * 1024;

export async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new RangeError("That is more than the organizer can hold. Try shortening your notes.");
  try {
    return JSON.parse(text);
  } catch {
    throw new SyntaxError("Invalid request");
  }
}

/** The `code` field of a JSON body, or "". */
export async function readCode(request: Request): Promise<string> {
  const input = (await readBody(request)) as { code?: unknown } | null;
  return typeof input?.code === "string" ? input.code.slice(0, 64) : "";
}

export async function withPlan(request: Request, fn: (ctx: PlanSessionContext) => Promise<Response>): Promise<Response> {
  try {
    const ctx = await resolvePlanSession(await getDb(), cookieFromHeader(request.headers.get("cookie"), PLAN_SESSION_COOKIE));
    if (!ctx) {
      const res = NextResponse.json({ error: "Your sign-in has ended. Ask for a new link to keep going." }, { status: 401, headers: noStore });
      res.headers.append("set-cookie", clearPlanSessionCookie());
      return res;
    }
    return await fn(ctx);
  } catch (err) {
    return planError(err);
  }
}

export function planError(err: unknown): Response {
  if (err instanceof FamilyPlanConfigError) return NextResponse.json({ error: "Saving plans is not available right now. Your answers are still on this device." }, { status: 503 });
  if (err instanceof RangeError) return NextResponse.json({ error: err.message }, { status: 413 });
  if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  console.error("family plan route failed", err instanceof Error ? err.message : "unknown error");
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** A wrong or paused code, in words. */
export function codeError(r: CodeFailure | { ok: false; reason: string; lockedUntil?: string }): Response {
  if (r.reason === "locked") {
    return NextResponse.json(
      { error: "Too many wrong codes. Codes are paused for 15 minutes to keep your account safe.", reason: "locked", lockedUntil: r.lockedUntil },
      { status: 429, headers: noStore },
    );
  }
  if (r.reason === "not_started") return NextResponse.json({ error: "Start again from the account page.", reason: r.reason }, { status: 409, headers: noStore });
  return NextResponse.json({ error: "That code did not work. Check the time on your phone and try the newest code.", reason: "bad_code" }, { status: 422, headers: noStore });
}

export const noStore = { "cache-control": "no-store" };
