import { buildCaseView } from "@/server/portal/caseView";
import { withActor } from "@/server/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, ({ db, actor }) => buildCaseView(db, actor, id));
}
