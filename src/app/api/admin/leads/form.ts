/**
 * The leads desk's forms post here without JavaScript. Each handler runs inside withActor (session, MFA,
 * policy errors), then sends the browser back to the page with a short ok or error message to show.
 */
import { NextResponse } from "next/server";
import { ForbiddenError } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { withActor } from "@/server/http";
import type { Actor } from "@/server/types";

export type FormHandler = (ctx: { db: Db; actor: Actor; form: FormData }) => Promise<{ ok: string; to?: string }>;

export function formAction(request: Request, back: string, handler: FormHandler): Promise<Response> {
  return withActor(request, async ({ db, actor }) => {
    const form = await request.formData().catch(() => new FormData());
    const go = (path: string, key: "ok" | "error", msg: string) => {
      const url = new URL(path, request.url);
      url.searchParams.set(key, msg);
      return NextResponse.redirect(url, 303);
    };
    try {
      const { ok, to } = await handler({ db, actor, form });
      return go(to ?? back, "ok", ok);
    } catch (err) {
      if (err instanceof ForbiddenError) throw err;
      return go(back, "error", err instanceof Error ? err.message : "Something went wrong");
    }
  });
}

export const field = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
};
