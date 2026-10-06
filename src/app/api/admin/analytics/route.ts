import { funnelReport } from "@/server/analytics";
import { withActor } from "@/server/http";

/** GET /api/admin/analytics?from=2026-09-01&to=2026-10-01&firmId=... */
export async function GET(request: Request) {
  return withActor(request, ({ db, actor }) => {
    const url = new URL(request.url);
    const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
    const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(to.getTime() - 30 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new Error("Invalid date range");
    return funnelReport(db, actor, { from, to, firmId: url.searchParams.get("firmId") ?? undefined });
  });
}
