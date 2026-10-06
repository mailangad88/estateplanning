import { withActor } from "@/server/http";
import { listPageQueue } from "@/server/content/pageApprovals";

export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => await listPageQueue(db, actor));
}
