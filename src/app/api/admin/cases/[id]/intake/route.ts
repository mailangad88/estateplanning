import { isQuestionField } from "@/lib/intakeQuestionnaire";
import { markQuestionnaireReady, saveQuestionnaire, sendToParalegal } from "@/server/services/questionnaire";
import { caseFormPost } from "../../caseForm";

/**
 * POST (form or JSON) the intake questionnaire. `intent`:
 * - "save" (default): save the answers (every field id from src/lib/intakeQuestionnaire.ts)
 * - "send": save, then send to `paralegalId` with an optional `note`
 * - "ready": save, then mark complete and ready for attorney review
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return caseFormPost(request, `/admin/cases/${encodeURIComponent(id)}/intake`, async ({ db, actor }, body) => {
    const intent = body.intent || "save";
    const answers = Object.fromEntries(Object.entries(body).filter(([k]) => isQuestionField(k)));
    // A paralegal's "ready" or an attorney's "send" also saves what is on screen first.
    if (body.has_answers === "1" || Object.keys(answers).length) await saveQuestionnaire(db, actor, id, answers);
    if (intent === "send") await sendToParalegal(db, actor, id, body.paralegalId ?? "", body.note);
    else if (intent === "ready") await markQuestionnaireReady(db, actor, id, body.note);
    else if (intent !== "save") throw new Error("intent must be save, send or ready");
    return [intent, { ok: true }];
  });
}
