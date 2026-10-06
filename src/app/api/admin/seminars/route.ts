import { readJson, withActor } from "@/server/http";
import { createSeminar, type SeminarInput } from "@/server/services/seminars";

export async function POST(request: Request) {
  return withActor(request, async ({ db, actor }) => await createSeminar(db, actor, await readJson<SeminarInput>(request)), { scopedWrites: true });
}
