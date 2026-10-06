import { declineOffer } from "@/server/services/routing";
import { readJson, withActor } from "@/server/http";
import type { DeclineReason } from "@/server/types";

const REASONS: DeclineReason[] = ["conflict", "capacity", "out_of_scope", "other"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const { reason, note } = await readJson<{ reason: DeclineReason; note?: string }>(request);
    if (!REASONS.includes(reason)) throw new Error("Choose a reason for declining");
    declineOffer(db, actor, id, reason, note);
    return { ok: true };
  });
}
