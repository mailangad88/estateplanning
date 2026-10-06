import { approveEngagement } from "@/server/services/engagement";
import { withActor } from "@/server/http";

/** One-click approval by the assigned attorney. Required before anything is sent. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const e = await approveEngagement(db, actor, id);
    return { id: e.id, status: e.status };
  });
}
