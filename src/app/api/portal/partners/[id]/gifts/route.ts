import { NextResponse } from "next/server";
import { readJson, withActor } from "@/server/http";
import { GiftBlockedError, logGift } from "@/server/services/partners";

/** Logs a gift through the gate. Blocked gifts come back as 422 with the rule explained and are not stored. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = await readJson<Record<string, unknown>>(request);
    const dollars = Number(body.valueUsd);
    try {
      const gift = await logGift(db, actor, id, {
        date: String(body.date ?? ""),
        description: String(body.description ?? ""),
        valueCents: Number.isFinite(dollars) ? Math.round(dollars * 100) : -1,
        tiedToReferral: body.tiedToReferral === true,
        thingOfValue: body.thingOfValue === true,
        note: typeof body.note === "string" ? body.note : undefined,
      });
      return { gift };
    } catch (err) {
      if (err instanceof GiftBlockedError) return NextResponse.json({ error: err.message, blocked: true, reasons: err.reasons }, { status: 422 });
      throw err;
    }
  }, { scopedWrites: true });
}
