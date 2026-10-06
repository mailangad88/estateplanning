import { retryAbandonedConversions } from "@/server/conversions/sweep";
import { withActor } from "@/server/http";

/** POST /api/admin/conversions/retry: puts abandoned conversions back in the queue. */
export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => ({ retried: await retryAbandonedConversions(db, actor) }));
}
