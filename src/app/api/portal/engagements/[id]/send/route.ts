import { esignProviderFromEnv } from "@/server/esign";
import { paymentProviderFromEnv } from "@/server/esign/payments";
import { sendEngagement } from "@/server/services/engagement";
import { withActor } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const e = await sendEngagement(db, actor, id, esignProviderFromEnv(), paymentProviderFromEnv());
    return { id: e.id, status: e.status };
  });
}
