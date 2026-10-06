import { NextResponse } from "next/server";
import { cronAuthorized } from "@/server/http";
import { getDb } from "@/server/runtime";
import { capacityReport } from "@/server/services/capacity";

/**
 * Machine-readable spend posture for ad scripts and schedulers (bearer CRON_SECRET).
 * Firm totals only: no lawyer names, no lead details.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await capacityReport(await getDb());
  return NextResponse.json({
    generatedAt: r.generatedAt,
    spendAdvice: r.spendAdvice,
    reason: r.reason,
    status: r.firm.status,
    soonestSlotDays: r.firm.soonestSlotDays,
    utilization: r.firm.utilization,
  });
}
