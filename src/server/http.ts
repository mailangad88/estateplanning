/**
 * Shared plumbing for portal API routes: resolves the session, maps policy
 * failures to 401/403, and slides the idle timeout forward on each request.
 */
import { NextResponse } from "next/server";
import { ForbiddenError, requireMfa } from "@/server/auth/policy";
import { actorFromSession, cookieFromHeader, sessionCookie, touchSession } from "@/server/auth/session";
import type { Db } from "@/server/db";
import { getDb } from "@/server/runtime";
import type { Actor } from "@/server/types";

export type Handler = (ctx: { db: Db; actor: Actor; request: Request }) => Promise<unknown> | unknown;

export async function withActor(request: Request, handler: Handler): Promise<Response> {
  const db = await getDb();
  const token = cookieFromHeader(request.headers.get("cookie"));
  const actor = await actorFromSession(db, token);
  if (!actor || !token) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  try {
    requireMfa(actor);
    const result = await handler({ db, actor, request });
    const res = result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    const touched = touchSession(token);
    if (touched) res.headers.append("set-cookie", sessionCookie(touched));
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
  if (err instanceof Error && err.name === "ZodError") return NextResponse.json({ error: "Check the fields and try again" }, { status: 422 });
  if (err instanceof Error) return NextResponse.json({ error: err.message }, { status: 400 });
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid request body");
  }
}

/** Cron endpoints authenticate with a bearer secret, not a user session. */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
