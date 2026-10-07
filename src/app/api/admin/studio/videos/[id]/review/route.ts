import { readJson, withActor } from "@/server/http";
import { review } from "@/server/studio/pipeline";
import { getStudioStore } from "@/server/studio/store";

/** The attorney approves, sends back or rejects the exact version on screen (contentHash). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ actor }) => {
    const body = await readJson<{ decision?: unknown; contentHash?: unknown; note?: unknown; confirmed?: unknown }>(request);
    const decision = body.decision === "approved" || body.decision === "rejected" ? body.decision : "changes_requested";
    const v = await review(await getStudioStore(), actor, id, {
      decision,
      contentHash: String(body.contentHash ?? ""),
      note: body.note === undefined ? undefined : String(body.note),
      confirmed: body.confirmed === true,
    });
    return { id: v.id, stage: v.stage };
  });
}
