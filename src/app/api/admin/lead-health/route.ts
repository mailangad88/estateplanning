import { leadHealthReport } from "@/server/leadHealth";
import { withActor } from "@/server/http";

/** GET /api/admin/lead-health */
export async function GET(request: Request) {
  return withActor(request, ({ db, actor }) => leadHealthReport(db, actor));
}
