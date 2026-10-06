import { withActor, readJson } from "@/server/http";
import { addComment } from "@/server/services/caseWork";
import { clientLeadId } from "@/server/services/clientPortal";

export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const { body } = await readJson<{ body?: string }>(request);
    const leadId = await clientLeadId(db, actor);
    if (!leadId) throw new Error("No case found");
    // Clients can only ever post client-visible messages.
    const c = await addComment(db, actor, { leadId, body: body ?? "", visibility: "client" });
    return { id: c.id };
  });
}
