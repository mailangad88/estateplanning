/**
 * The intake questionnaire workflow on a case (/admin/cases/[id]/intake):
 *   1. the attorney fills it in during or after the call (saveQuestionnaire)
 *   2. sends it to a paralegal, which assigns them to the case (sendToParalegal)
 *   3. the paralegal completes it and marks it ready (markQuestionnaireReady), which ticks off the
 *      "Info + documents gathered" journey step when the case is on it
 *   4. the attorney signs it off with the attorney review step; it is locked from then on
 * Every hand-off also posts a firm-visible comment on the case, so the thread reads as a log.
 */
import { cleanAnswers, isQuestionField, prefillAnswers, questionnaireProgress, questionnaireStage, type QuestionnaireStage } from "@/lib/intakeQuestionnaire";
import { buildJourney } from "@/lib/caseJourney";
import { audit } from "@/server/audit/log";
import { assertCan, canOnLead, ForbiddenError, readableVisibilities, requireMfa } from "@/server/auth/policy";
import type { Db } from "@/server/db";
import { assignParalegal, updateCaseStep } from "@/server/services/caseBoard";
import { addComment } from "@/server/services/caseWork";
import type { Actor, Comment, Lead, QuestionnaireRecord } from "@/server/types";

async function load(db: Db, leadId: string) {
  const lead = await db.leads.get(leadId);
  if (!lead) throw new ForbiddenError();
  return { lead, assignments: await db.assignments.list(undefined, { leadId }) };
}

function assertOpen(lead: Lead) {
  if (questionnaireStage(lead) === "signed_off") throw new Error("The attorney has signed this questionnaire off. It is locked.");
  if (lead.exit) throw new Error("This case was closed early");
}

export interface QuestionnaireView {
  answers: Record<string, string>;
  /** True when nothing is saved yet and the answers come from intake */
  prefilled: boolean;
  record?: QuestionnaireRecord;
  stage: QuestionnaireStage;
  progress: ReturnType<typeof questionnaireProgress>;
  canEdit: boolean;
  canSend: boolean;
  canMarkReady: boolean;
  comments: Comment[];
}

export async function questionnaireView(db: Db, actor: Actor, leadId: string, now = new Date()): Promise<QuestionnaireView> {
  requireMfa(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "view", lead, assignments, now) && !!lead.assignedLawyerId);
  const stage = questionnaireStage(lead);
  const person = await db.persons.get(lead.personId);
  const answers = lead.questionnaire?.answers ?? prefillAnswers(lead, person);
  const progress = questionnaireProgress(answers);
  const open = stage !== "signed_off" && !lead.exit;
  const canEdit = open && canOnLead(actor, "edit_questionnaire", lead, assignments, now);
  await audit(db, actor, { action: "questionnaire.view", resourceType: "lead", resourceId: lead.id, leadId: lead.id, at: now });
  return {
    answers,
    prefilled: !lead.questionnaire,
    record: lead.questionnaire,
    stage,
    progress,
    canEdit,
    canSend: open && canOnLead(actor, "assign_paralegal", lead, assignments, now),
    canMarkReady: canEdit && stage === "paralegal" && progress.requiredLeft === 0,
    comments: await caseComments(db, actor, lead.id),
  };
}

export async function saveQuestionnaire(db: Db, actor: Actor, leadId: string, input: Record<string, unknown>, now = new Date()): Promise<Lead> {
  requireMfa(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "edit_questionnaire", lead, assignments, now), "Only the attorney or the case's paralegal can fill this in");
  assertOpen(lead);
  const at = now.toISOString();
  const prev = lead.questionnaire;
  // Only the fields sent are changed (an empty value clears one), so a partial save never wipes the rest.
  const cleaned = cleanAnswers(input);
  const answers: Record<string, string> = { ...prev?.answers };
  for (const key of Object.keys(input)) {
    if (!isQuestionField(key)) continue;
    if (cleaned[key]) answers[key] = cleaned[key];
    else delete answers[key];
  }
  const record: QuestionnaireRecord = {
    ...(prev ?? { startedAt: at, startedBy: actor.userId }),
    answers,
    updatedAt: at,
    updatedBy: actor.userId,
  };
  // Changing a required answer after it was marked ready sends it back to "paralegal completes".
  if (record.readyAt && questionnaireProgress(answers).requiredLeft > 0) {
    delete record.readyAt;
    delete record.readyBy;
  }
  const next = await db.leads.update(lead.id, { questionnaire: record });
  const changed = Object.keys({ ...prev?.answers, ...answers }).filter((k) => (prev?.answers[k] ?? "") !== (answers[k] ?? ""));
  // The audit trail names the fields that changed, never their contents.
  await audit(db, actor, { action: "questionnaire.save", resourceType: "lead", resourceId: lead.id, leadId: lead.id, detail: { fields: changed }, at: now });
  return next;
}

/** Hand the questionnaire to a paralegal: assigns them to the case and posts the attorney's note on the thread. */
export async function sendToParalegal(db: Db, actor: Actor, leadId: string, paralegalId: string, note?: string, now = new Date()): Promise<Lead> {
  requireMfa(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "assign_paralegal", lead, assignments, now), "Only the case's attorney or the office can send this to a paralegal");
  assertOpen(lead);
  if (!lead.questionnaire) throw new Error("Save the questionnaire first");
  if (!paralegalId) throw new Error("Pick a paralegal");
  await assignParalegal(db, actor, lead.id, paralegalId, now);
  const fresh = (await db.leads.get(lead.id))!;
  const at = now.toISOString();
  const next = await db.leads.update(lead.id, {
    questionnaire: { ...fresh.questionnaire!, sentAt: at, sentBy: actor.userId, sentTo: paralegalId, readyAt: undefined, readyBy: undefined },
  });
  const para = await db.users.get(paralegalId);
  const body = `Sent the intake questionnaire to ${para?.name ?? "the paralegal"}.${note?.trim() ? `\n\n${note.trim()}` : ""}`;
  await addComment(db, actor, { leadId: lead.id, body, visibility: "firm" }, now);
  await audit(db, actor, { action: "questionnaire.send", resourceType: "lead", resourceId: lead.id, leadId: lead.id, detail: { to: paralegalId }, at: now });
  return next;
}

/** The paralegal (or attorney) says it is complete. Ticks off "Info + documents gathered" if the case is on that step. */
export async function markQuestionnaireReady(db: Db, actor: Actor, leadId: string, note?: string, now = new Date()): Promise<Lead> {
  requireMfa(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "edit_questionnaire", lead, assignments, now), "Only the attorney or the case's paralegal can do this");
  assertOpen(lead);
  if (!lead.questionnaire?.sentAt) throw new Error("The attorney has not sent this to a paralegal yet");
  const left = questionnaireProgress(lead.questionnaire.answers).requiredLeft;
  if (left > 0) throw new Error(`${left} required ${left === 1 ? "answer is" : "answers are"} still empty`);
  const at = now.toISOString();
  let next = await db.leads.update(lead.id, { questionnaire: { ...lead.questionnaire, readyAt: at, readyBy: actor.userId } });
  if (buildJourney(next, now).current?.key === "documents_gathered") {
    next = await updateCaseStep(db, actor, lead.id, "documents_gathered", "done", "Intake questionnaire complete", now);
  }
  await addComment(db, actor, { leadId: lead.id, body: `Questionnaire complete and ready for attorney review.${note?.trim() ? `\n\n${note.trim()}` : ""}`, visibility: "firm" }, now);
  await audit(db, actor, { action: "questionnaire.ready", resourceType: "lead", resourceId: lead.id, leadId: lead.id, at: now });
  return next;
}

/** The case's comment thread as this viewer may read it, oldest first. */
export async function caseComments(db: Db, actor: Actor, leadId: string): Promise<Comment[]> {
  const readable = readableVisibilities(actor);
  return (await db.comments.list((c) => readable.includes(c.visibility), { leadId })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** A comment from the case board: firm-visible, so the attorney, paralegal and office all see it. */
export async function postCaseComment(db: Db, actor: Actor, leadId: string, body: string, now = new Date()): Promise<Comment> {
  requireMfa(actor);
  const { lead, assignments } = await load(db, leadId);
  assertCan(canOnLead(actor, "view", lead, assignments, now) && !!lead.assignedLawyerId);
  return addComment(db, actor, { leadId, body, visibility: "firm" }, now);
}
