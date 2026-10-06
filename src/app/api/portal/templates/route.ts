import { assertCan, can } from "@/server/auth/policy";
import { withActor } from "@/server/http";
import { listTemplateRows } from "@/server/nurture/templates";

export async function GET(request: Request) {
  return withActor(request, async ({ db, actor }) => {
    assertCan(can(actor, "approve_templates"));
    return { templates: await listTemplateRows(db, actor) };
  });
}
