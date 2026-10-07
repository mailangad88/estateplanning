import { readJson, withActor } from "@/server/http";
import { setPlaces } from "@/server/studio/publish";
import { getStudioStore } from "@/server/studio/store";

/** Where a video goes: { platforms: ["youtube", "instagram"] }. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ actor }) => {
    const body = await readJson<{ platforms?: unknown }>(request);
    const v = await setPlaces(await getStudioStore(), actor, id, Array.isArray(body.platforms) ? body.platforms.map(String) : []);
    return { id: v.id, targets: v.targets, stage: v.stage };
  });
}
