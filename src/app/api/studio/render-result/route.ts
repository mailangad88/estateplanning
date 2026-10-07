import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/server/http";
import { recordRender, workerAuthorized } from "@/server/studio/render";
import { getStudioStore } from "@/server/studio/store";

/** The render worker reports a finished or failed render. */
export async function POST(request: Request) {
  if (!workerAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b = await readJson<Record<string, unknown>>(request);
    const opt = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : undefined);
    const v = await recordRender(await getStudioStore(), {
      id: String(b.id ?? ""),
      contentHash: String(b.contentHash ?? ""),
      status: b.status === "done" ? "done" : "failed",
      videoUrl: opt("videoUrl"),
      thumbnailUrl: opt("thumbnailUrl"),
      captionsUrl: opt("captionsUrl"),
      error: opt("error"),
    });
    return NextResponse.json({ id: v.id, render: v.render.status });
  } catch (err) {
    return errorResponse(err);
  }
}
