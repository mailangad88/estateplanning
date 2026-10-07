import { z } from "zod";
import type { DraftInput } from "@/server/services/engagement";

const Cents = z.number().int().positive();

/** The lead page's "Send retainer" form: package and price, payment plan, couple, and any fields the lawyer filled in. */
export const RetainerForm = z.object({
  terms: z.object({
    tierId: z.string().min(1),
    tierPriceCents: Cents,
    addOns: z.array(z.object({ id: z.string().min(1), priceCents: Cents })).max(12).optional(),
    plan: z
      .discriminatedUnion("mode", [
        z.object({ mode: z.literal("full") }),
        z.object({ mode: z.literal("plan"), depositCents: Cents, installments: z.number().int().positive() }),
      ])
      .optional(),
  }),
  spouseName: z.string().max(200).optional(),
  mergeValues: z.record(z.string(), z.string().max(2000)).optional(),
  templateId: z.string().max(200).optional(),
  useFallback: z.boolean().optional(),
});

export function draftInput(leadId: string, body: unknown): DraftInput {
  const f = RetainerForm.parse(body);
  return {
    leadId,
    terms: f.terms,
    couple: f.spouseName?.trim() ? { spouseName: f.spouseName.trim() } : undefined,
    mergeValues: f.mergeValues,
    templateId: f.templateId || undefined,
    useFallback: f.useFallback,
  };
}
