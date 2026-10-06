import { z } from "zod";
import { paymentProviderFromEnv } from "@/server/esign/payments";
import { readJson, withActor } from "@/server/http";
import { refundPayment } from "@/server/services/retainerPayments";

const Body = z.object({ amountCents: z.number().int().positive(), reason: z.string().trim().min(1).max(500) });

/** The assigned attorney refunds a payment, in full or in part. The provider returns it from the account it went to. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = Body.parse(await readJson(request));
    const p = await refundPayment(db, actor, id, body.amountCents, body.reason, paymentProviderFromEnv());
    return { id: p.id, refunds: p.refunds.length };
  });
}
