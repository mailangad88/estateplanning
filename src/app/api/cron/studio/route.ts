import { NextResponse } from "next/server";
import { cronAuthorized } from "@/server/http";
import { runStudioCron } from "@/server/studio/cron";
import { getStudioStore } from "@/server/studio/store";

/**
 * Run every 15 minutes by the scheduler. Drafts new videos only with STUDIO_AUTO_DRAFT=true,
 * fills publish slots with approved videos, then posts what is due. Posting is a dry run
 * (logged only) unless STUDIO_PUBLISH_MODE is "private" or "live".
 */
/** Uploads read the rendered file into memory and send it on; give long videos time. */
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runStudioCron(await getStudioStore()));
  } catch (err) {
    console.error("studio cron failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Studio run failed" }, { status: 500 });
  }
}
