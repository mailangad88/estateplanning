import { z } from "zod";
import { readJson, withActor } from "@/server/http";
import { recordOutcome } from "@/server/services/referrals";
import { REFERRAL_OUTCOMES } from "@/server/types";

const Body = z.object({ outcome: z.enum(REFERRAL_OUTCOMES as [string, ...string[]]), note: z.string().max(500).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const { outcome, note } = Body.parse(await readJson(request));
    await recordOutcome(db, actor, id, outcome as (typeof REFERRAL_OUTCOMES)[number], note);
    return { ok: true };
  });
}
