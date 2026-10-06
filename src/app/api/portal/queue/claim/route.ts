import { withActor, readJson } from "@/server/http";
import { claimLead } from "@/server/services/intakeQueue";

export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const { leadId } = await readJson<{ leadId?: string }>(request);
    if (!leadId) throw new Error("leadId is required");
    await claimLead(db, actor, leadId);
    return { ok: true, leadId };
  });
}
