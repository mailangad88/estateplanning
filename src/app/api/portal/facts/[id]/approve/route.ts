import { approveFact } from "@/server/facts/verify";
import { readJson, withActor } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const body = await readJson<{ value: string; note?: string }>(request);
    return await approveFact(db, actor, { factId: id, value: String(body.value ?? ""), note: body.note === undefined ? undefined : String(body.note) });
  });
}
