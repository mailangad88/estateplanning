import { NextResponse } from "next/server";
import { previewPlan } from "@/server/services/familyPlan";
import { noStore, planError, readBody } from "../shared";

/** Progress and gaps for a draft kept only on the visitor's device. Validates; stores nothing. */
export async function POST(request: Request) {
  try {
    const input = (await readBody(request)) as { body?: unknown } | null;
    const result = previewPlan(input?.body);
    if (!result.ok) return NextResponse.json({ error: result.error, fields: result.fields }, { status: 422, headers: noStore });
    return NextResponse.json({ summary: result.summary }, { headers: noStore });
  } catch (err) {
    return planError(err);
  }
}
