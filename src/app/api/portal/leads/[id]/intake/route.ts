import { updateIntake, type IntakeUpdate } from "@/server/services/leads";
import { readJson, withActor } from "@/server/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const lead = await updateIntake(db, actor, id, await readJson<IntakeUpdate>(request));
    return { ok: true, stage: lead.stage, urgent: lead.urgent };
  });
}
