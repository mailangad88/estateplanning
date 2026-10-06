import { NextResponse } from "next/server";
import { beginAuthenticatorChange, cancelAuthenticatorChange, confirmAuthenticatorChange, formatSecret } from "@/server/services/planAccount";
import { codeError, noStore, readBody, withPlan } from "../../shared";

/**
 * Moving to a new phone. {step: "begin", code} with a code from the current app (or a recovery code)
 * returns a new key; {step: "confirm", code} with the new app's first code switches over; {step: "cancel"}.
 */
export async function POST(request: Request) {
  return withPlan(request, async (ctx) => {
    const input = (await readBody(request)) as { step?: unknown; code?: unknown } | null;
    const code = typeof input?.code === "string" ? input.code.slice(0, 64) : "";
    if (input?.step === "begin") {
      const r = await beginAuthenticatorChange(ctx, code);
      if (!r.ok) return codeError(r);
      return NextResponse.json({ secret: formatSecret(r.secret), otpauthUrl: r.otpauthUrl }, { headers: noStore });
    }
    if (input?.step === "confirm") {
      const r = await confirmAuthenticatorChange(ctx, code);
      if (!r.ok) return codeError(r);
      return NextResponse.json({ ok: true }, { headers: noStore });
    }
    if (input?.step === "cancel") {
      await cancelAuthenticatorChange(ctx);
      return NextResponse.json({ ok: true }, { headers: noStore });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: noStore });
  });
}
