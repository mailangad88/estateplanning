import { NextResponse } from "next/server";
import { claimRenderJobs, workerAuthorized } from "@/server/studio/render";
import { getStudioStore } from "@/server/studio/store";

/** The render worker takes up to `limit` approved videos to render (bearer STUDIO_WORKER_TOKEN). */
export async function POST(request: Request) {
  if (!workerAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Math.min(10, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 4));
  return NextResponse.json({ jobs: await claimRenderJobs(await getStudioStore(), limit) });
}
