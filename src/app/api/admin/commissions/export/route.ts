import { withActor } from "@/server/http";
import { commissionCsv } from "@/server/services/commissions";

/** GET: paralegal commissions as CSV for payroll. Office only. */
export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const csv = await commissionCsv(db, actor);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="paralegal-commissions-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  });
}
