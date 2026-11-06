import { z } from "zod";
import { readJson, withActor } from "@/server/http";
import { closeLead, MANUAL_EXIT_REASONS, MANUAL_STAGES, moveStage, reopenLead } from "@/server/services/leadWork";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("move"), stage: z.enum(MANUAL_STAGES) }),
  z.object({ action: z.literal("close"), reason: z.enum(MANUAL_EXIT_REASONS), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("reopen") }),
]);

/** Move a lead to contacted or qualified, close it with a reason, or reopen it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = Body.parse(await readJson(request));
    const lead =
      body.action === "move" ? await moveStage(db, actor, id, body.stage)
      : body.action === "close" ? await closeLead(db, actor, id, body.reason, body.note)
      : await reopenLead(db, actor, id);
    return { ok: true, stage: lead.stage, closed: !!lead.exit };
  });
}
