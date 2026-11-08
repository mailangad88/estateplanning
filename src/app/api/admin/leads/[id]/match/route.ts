import { matchLead } from "@/server/services/leadDesk";
import { formAction } from "../../form";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return formAction(request, `/admin/leads/${id}`, async ({ db, actor }) => {
    const result = await matchLead(db, actor, id);
    return { ok: result.offered ? "Offered to an attorney in the network. You'll see it here once they accept." : "No attorney in the network fits this lead right now. Consider an outside referral from the case file." };
  });
}
