import { NextResponse } from "next/server";
import { withActor } from "@/server/http";
import { exportPageApprovals } from "@/server/content/pageApprovals";

/** Approvals as JSON for `npm run review:apply -- --from <file>`. Attorneys and platform admins only. */
export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const data = await exportPageApprovals(db, actor);
    return NextResponse.json(data, {
      headers: { "content-disposition": `attachment; filename="page-approvals-${data.exportedAt.slice(0, 10)}.json"`, "cache-control": "no-store" },
    });
  });
}
