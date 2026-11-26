import { postCaseComment } from "@/server/services/questionnaire";
import { caseFormPost } from "../../caseForm";

/** POST (form or JSON) { body, back? }: a firm-visible comment on the case. `back` = "intake" returns to the questionnaire. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const back = new URL(request.url).searchParams.get("back") === "intake" ? `/admin/cases/${encodeURIComponent(id)}/intake#thread` : `/admin/cases/${encodeURIComponent(id)}#thread`;
  return caseFormPost(request, back, async ({ db, actor }, body) => {
    const comment = await postCaseComment(db, actor, id, body.body ?? "");
    return ["comment", comment];
  });
}
