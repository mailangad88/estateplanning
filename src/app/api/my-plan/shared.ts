/**
 * Plumbing for the /api/my-plan routes. A plan session is its own cookie (ep_plan): it is never a
 * portal session and reaches no portal route, and its store is scoped to the one plan.
 */
import { NextResponse } from "next/server";
import { cookieFromHeader } from "@/server/auth/session";
import type { Db } from "@/server/db";
import { getDb, plannerDb } from "@/server/runtime";
import { FamilyPlanConfigError, PLAN_SESSION_COOKIE, readPlanSession } from "@/server/services/familyPlan";

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

export async function withPlan(request: Request, fn: (ctx: { planId: string; db: Db }) => Promise<Response>): Promise<Response> {
  const planId = readPlanSession(cookieFromHeader(request.headers.get("cookie"), PLAN_SESSION_COOKIE));
  if (!planId) return NextResponse.json({ error: "Your sign-in has ended. Ask for a new link to keep going." }, { status: 401 });
  try {
    return await fn({ planId, db: plannerDb(await getDb(), planId) });
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

export const noStore = { "cache-control": "no-store" };
