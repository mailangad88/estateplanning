import { z } from "zod";
import { draftEngagement, type DraftInput } from "@/server/services/engagement";
import { readJson, withActor } from "@/server/http";

const Cents = z.number().int().positive();
const Terms = z.object({
  tierId: z.string().min(1),
  tierPriceCents: Cents,
  addOns: z.array(z.object({ id: z.string().min(1), priceCents: Cents })).max(12).optional(),
  plan: z
    .discriminatedUnion("mode", [
      z.object({ mode: z.literal("full") }),
      z.object({ mode: z.literal("plan"), depositCents: Cents, installments: z.number().int().positive() }),
    ])
    .optional(),
});

/**
 * The assigned attorney or their paralegal drafts the engagement after the consult. Send either
 * `terms` (good/better/best package, the attorney's prices, add-ons and payment plan) or the original
 * `packageId` + `feeCents`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const input = await readJson<Omit<DraftInput, "leadId" | "terms"> & { terms?: unknown }>(request);
    const terms = input.terms === undefined ? undefined : Terms.parse(input.terms);
    const e = await draftEngagement(db, actor, { ...input, terms, leadId: id });
    return { id: e.id, status: e.status, letter: e.letter };
  });
}
