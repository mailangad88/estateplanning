import { z } from "zod";
import { readJson, withActor } from "@/server/http";
import { referLead } from "@/server/services/referrals";
import { REFERRAL_REASONS } from "@/server/types";

const Body = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("platform"), lawyerId: z.string().min(1) }),
    z.object({ kind: z.literal("outside"), name: z.string().max(200), firm: z.string().max(200).optional(), contact: z.string().max(200).optional() }),
  ]),
  reason: z.enum(REFERRAL_REASONS as [string, ...string[]]),
  note: z.string().max(1000).optional(),
  clientAgreed: z.boolean(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = Body.parse(await readJson(request));
    const referral = await referLead(db, actor, id, { ...body, reason: body.reason as (typeof REFERRAL_REASONS)[number] });
    return { ok: true, referralId: referral.id };
  });
}
