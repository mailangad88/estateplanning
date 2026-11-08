import { exportLeads, parseFilters } from "@/server/services/leadDesk";
import { withActor } from "@/server/http";

/** CSV of the leads matching the list page's filters. Owners and office admins only; every download is audited. */
export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const sp = Object.fromEntries(new URL(request.url).searchParams);
    const { csv } = await exportLeads(db, actor, parseFilters(sp));
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="leads-${day}.csv"`,
        "cache-control": "no-store",
      },
    });
  });
}
