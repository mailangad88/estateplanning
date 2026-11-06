import { esignProviderFromEnv } from "@/server/esign";
import { paymentProviderFromEnv } from "@/server/esign/payments";
import { readJson, withActor } from "@/server/http";
import { approveEngagement, draftEngagement, sendEngagement } from "@/server/services/engagement";
import { draftInput } from "../shared";

/**
 * One click from the lead page. The same three steps as before, so fee rules, payment plan limits and the
 * audit trail all still apply: draft (refused while a merge field is empty), then, when the assigned attorney
 * is the one clicking, approve and send. A paralegal's click prepares the draft for the attorney to approve.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const draft = await draftEngagement(db, actor, draftInput(id, await readJson(request)));
    if (actor.role !== "attorney") return { id: draft.id, status: draft.status };
    await approveEngagement(db, actor, draft.id);
    const sent = await sendEngagement(db, actor, draft.id, esignProviderFromEnv(), paymentProviderFromEnv());
    return { id: sent.id, status: sent.status, signingInvite: sent.signingInvite ?? null };
  });
}
