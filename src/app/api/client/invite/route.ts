import { withActor, readJson } from "@/server/http";
import { inviteClient } from "@/server/services/clientPortal";

export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const { leadId } = await readJson<{ leadId?: string }>(request);
    if (!leadId) throw new Error("Choose a case");
    const { link } = await inviteClient(db, actor, leadId);
    // The attorney copies this link and sends it to the client. Sending it automatically is a later step.
    return { link };
  });
}
