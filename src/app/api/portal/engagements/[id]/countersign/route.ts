import { countersignEngagement } from "@/server/services/engagement";
import { withActor } from "@/server/http";

/** The assigned attorney countersigns a signed retainer. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const e = await countersignEngagement(db, actor, id);
    return { id: e.id, status: e.status };
  });
}
