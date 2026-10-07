import { withActor } from "@/server/http";
import { unschedule } from "@/server/studio/schedule";
import { getStudioStore } from "@/server/studio/store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ actor }) => {
    const v = await unschedule(await getStudioStore(), actor, id);
    return { id: v.id, stage: v.stage };
  });
}
