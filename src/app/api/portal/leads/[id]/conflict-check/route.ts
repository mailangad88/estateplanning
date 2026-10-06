import { recordConflictCheck } from "@/server/services/leads";
import { offerNext } from "@/server/services/routing";
import { readJson, withActor } from "@/server/http";

/** Records the firm's conflict check. A clear result starts routing straight away. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const { result } = await readJson<{ result: "clear" | "conflict" }>(request);
    if (result !== "clear" && result !== "conflict") throw new Error("result must be clear or conflict");
    await recordConflictCheck(db, actor, id, result);
    if (result === "conflict") return { ok: true, routed: false };
    const offer = await offerNext(db, id);
    return { ok: true, routed: !!offer.offered, nextStep: offer.nextStep };
  });
}
