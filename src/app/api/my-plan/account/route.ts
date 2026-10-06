import { NextResponse } from "next/server";
import { accountOverview } from "@/server/services/planAccount";
import { noStore, withPlan } from "../shared";

/** Two-step status, signed-in devices and the account's own activity. */
export async function GET(request: Request) {
  return withPlan(request, async (ctx) => NextResponse.json(await accountOverview(ctx), { headers: noStore }));
}
