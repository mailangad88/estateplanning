import { acceptOffer } from "@/server/services/routing";
import { withActor } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, async ({ db, actor }) => {
    const lead = await acceptOffer(db, actor, id);
    return { ok: true, leadId: lead.id };
  });
}
