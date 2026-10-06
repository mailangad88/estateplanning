import { withActor, readJson } from "@/server/http";
import { inviteClient } from "@/server/services/clientPortal";

export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    const { leadId } = await readJson<{ leadId?: string }>(request);
    if (!leadId) throw new Error("Choose a case");
    const { link } = await inviteClient(db, actor, leadId);
    // TODO: send the link by email or text through the nurture layer instead of returning it to the attorney's screen.
    return { link };
  });
}
