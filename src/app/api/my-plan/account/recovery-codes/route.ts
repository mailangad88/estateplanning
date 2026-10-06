import { NextResponse } from "next/server";
import { regenerateRecoveryCodes } from "@/server/services/planAccount";
import { codeError, noStore, readCode, withPlan } from "../../shared";

/** New recovery codes after a fresh code. Shown once in this response; the old ones stop working. */
export async function POST(request: Request) {
  return withPlan(request, async (ctx) => {
    const r = await regenerateRecoveryCodes(ctx, await readCode(request));
    if (!r.ok) return codeError(r);
    return NextResponse.json({ recoveryCodes: r.recoveryCodes }, { headers: noStore });
  });
}
