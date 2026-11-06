import { z } from "zod";
import { readJson, withActor } from "@/server/http";
import { recordConsultOutcome } from "@/server/services/caseWork";

const Body = z.object({
  status: z.enum(["held", "no_show", "cancelled"]),
  outcome: z.enum(["proposal", "not_now", "not_a_fit"]).optional(),
  notes: z.string().max(2000).optional(),
});

/** Record whether a consult happened and how it ended. */
export async function POST(request: Request, { params }: { params: Promise<{ consultId: string }> }) {
  const { consultId } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = Body.parse(await readJson(request));
    if (body.outcome && body.status !== "held") throw new Error("Only a held consult has an outcome");
    await recordConsultOutcome(db, actor, consultId, body);
    return { ok: true };
  });
}
