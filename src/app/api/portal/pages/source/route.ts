import { withActor } from "@/server/http";
import { readPageForEdit } from "@/server/content/pageApprovals";

/** The title, description and markdown body of one page, for the inline editor. */
export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const pagePath = new URL(request.url).searchParams.get("path") ?? "";
    return await readPageForEdit(db, actor, pagePath);
  });
}
