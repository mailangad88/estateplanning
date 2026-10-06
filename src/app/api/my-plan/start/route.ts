import { NextResponse } from "next/server";
import { getDb } from "@/server/runtime";
import { startPlanSignIn } from "@/server/services/familyPlan";
import { noStore, planError, readBody } from "../shared";

/** Emails a link that saves the plan. The same answer whether or not the address already has a plan. */
export async function POST(request: Request) {
  try {
    const input = (await readBody(request)) as { email?: unknown; consent?: unknown; consentVersion?: unknown } | null;
    const result = await startPlanSignIn(await getDb(), {
      email: typeof input?.email === "string" ? input.email : "",
      consent: input?.consent === true,
      consentVersion: typeof input?.consentVersion === "string" ? input.consentVersion : "",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (err) {
    return planError(err);
  }
}
