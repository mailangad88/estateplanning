import { NextResponse } from "next/server";
import { withActor, type Handler } from "@/server/http";

/**
 * Case board form posts: accept a browser form (redirect back to `page` with ?ok= or ?error=) or JSON
 * (the usual JSON response). `run` gets the parsed body and returns [okFlag, jsonResult].
 */
export async function caseFormPost(
  request: Request,
  page: string,
  run: (ctx: Parameters<Handler>[0], body: Record<string, string>) => Promise<[string, unknown]>,
): Promise<Response> {
  const isForm = (request.headers.get("content-type") ?? "").includes("form");
  const [path, hash] = page.split("#");
  const back = (q: string) => NextResponse.redirect(new URL(`${path}${path.includes("?") ? "&" : "?"}${q}${hash ? `#${hash}` : ""}`, request.url), 303);
  const res = await withActor(request, async (ctx) => {
    const raw = isForm ? Object.fromEntries(await ctx.request.formData()) : await ctx.request.json().catch(() => ({}));
    const body = Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, typeof v === "string" ? v : String(v ?? "")]));
    const [ok, json] = await run(ctx, body);
    return isForm ? back(`ok=${encodeURIComponent(ok)}`) : json;
  });
  if (isForm && res.status >= 400) {
    const err = (await res.clone().json().catch(() => ({}))) as { error?: string };
    return back(`error=${encodeURIComponent(err.error ?? "Something went wrong")}`);
  }
  return res;
}
