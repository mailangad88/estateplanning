import { addComment } from "@/server/services/caseWork";
import { field, formAction } from "../../form";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return formAction(request, `/admin/leads/${id}#notes`, async ({ db, actor, form }) => {
    // Desk notes are internal where the role allows it; addComment checks access and falls back to the role's default.
    const visibility = actor.role === "platform_admin" || actor.role === "intake" ? "internal" : undefined;
    await addComment(db, actor, { leadId: id, body: field(form, "body").slice(0, 4000), visibility });
    return { ok: "Note saved.", to: `/admin/leads/${id}` };
  });
}
