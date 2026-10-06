import { readJson, withActor } from "@/server/http";
import { updateSeminar } from "@/server/services/seminars";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => await updateSeminar(db, actor, id, await readJson(request)), { scopedWrites: true });
}
