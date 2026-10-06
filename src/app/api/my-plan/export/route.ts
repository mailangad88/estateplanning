import { NextResponse } from "next/server";
import { exportPlanAccount } from "@/server/services/planAccount";
import { noStore, withPlan } from "../shared";

/** "Download my plan": everything kept for this account, as a JSON file. Audited. */
export async function GET(request: Request) {
  return withPlan(request, async (ctx) => {
    const data = await exportPlanAccount(ctx);
    if (!data) return NextResponse.json({ error: "This plan no longer exists" }, { status: 404, headers: noStore });
    const day = data.exportedAt.slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        ...noStore,
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="my-family-plan-${day}.json"`,
        "x-content-type-options": "nosniff",
      },
    });
  });
}
