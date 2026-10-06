import { addComment } from "@/server/services/caseWork";
import { readJson, withActor } from "@/server/http";
import type { Visibility } from "@/server/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = await readJson<{ body: string; visibility?: Visibility; parentId?: string }>(request);
    return addComment(db, actor, { leadId: id, body: String(body.body ?? ""), visibility: body.visibility, parentId: body.parentId });
  });
}
