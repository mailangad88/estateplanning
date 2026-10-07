import { readJson, withActor } from "@/server/http";
import { postNow } from "@/server/studio/publish";
import { getStudioStore } from "@/server/studio/store";

/** Post an approved video now to the picked places: { platforms }. Logs only while publishing is off. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ actor }) => {
    const body = await readJson<{ platforms?: unknown }>(request);
    const v = await postNow(await getStudioStore(), actor, id, Array.isArray(body.platforms) ? body.platforms.map(String) : []);
    return { id: v.id, stage: v.stage, posts: v.posts };
  });
}
