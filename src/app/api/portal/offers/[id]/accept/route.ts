import { acceptOffer } from "@/server/services/routing";
import { withActor } from "@/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withActor(request, ({ db, actor }) => {
    const lead = acceptOffer(db, actor, id);
    return { ok: true, leadId: lead.id };
  });
}
