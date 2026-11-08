import { logContact, type ContactResult, type CONTACT_KINDS } from "@/server/services/leadDesk";
import { field, formAction } from "../../form";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The call list posts with back=calls so the caller stays on the list.
  const back = new URL(request.url).searchParams.get("back") === "calls" ? "/admin/leads/calls" : `/admin/leads/${id}`;
  return formAction(request, back, async ({ db, actor, form }) => {
    await logContact(db, actor, id, {
      kind: field(form, "kind") as (typeof CONTACT_KINDS)[number],
      result: field(form, "result") as ContactResult,
      note: field(form, "note"),
    });
    return { ok: "Logged.", to: field(form, "back") === "calls" ? "/admin/leads/calls" : undefined };
  });
}
