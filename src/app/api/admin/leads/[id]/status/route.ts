import { closeLead, moveLead, reopenLead } from "@/server/services/leadDesk";
import type { ExitReason, Stage } from "@/server/types";
import { field, formAction } from "../../form";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return formAction(request, `/admin/leads/${id}`, async ({ db, actor, form }) => {
    const action = field(form, "action");
    if (action === "reopen") {
      await reopenLead(db, actor, id);
      return { ok: "Lead reopened." };
    }
    if (action === "close") {
      await closeLead(db, actor, id, field(form, "reason") as ExitReason, field(form, "note"));
      return { ok: "Lead closed." };
    }
    const stage = field(form, "stage") as Stage;
    if (!stage) throw new Error("Pick a status first");
    await moveLead(db, actor, id, stage);
    return { ok: "Status updated." };
  });
}
