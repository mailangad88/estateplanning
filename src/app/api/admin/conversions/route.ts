import { conversionsReport } from "@/server/conversions/sweep";
import { withActor } from "@/server/http";

/** GET /api/admin/conversions: the conversions log summary (ids, status, value; no contact details). */
export async function GET(request: Request) {
  return withActor(request, ({ db, actor }) => conversionsReport(db, actor));
}
