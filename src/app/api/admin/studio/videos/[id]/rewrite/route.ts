import { withActor } from "@/server/http";
import { rewrite } from "@/server/studio/pipeline";
import { getStudioStore } from "@/server/studio/store";

/** Writes the video again from scratch with the current writer. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ actor }) => {
    const v = await rewrite(await getStudioStore(), actor, id);
    return { id: v.id, stage: v.stage };
  });
}
