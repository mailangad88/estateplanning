import { beforeEach, describe, expect, it } from "vitest";
import { buildJourney, JOURNEY_STEPS, nextActionLabel } from "@/lib/caseJourney";
import { ForbiddenError } from "@/server/auth/policy";
import { createMemoryDb, type Db } from "@/server/db";
import { actorFor, DEMO_FIRM_ID, DEMO_USERS, seedDemo } from "@/server/seed";
import { assignParalegal, caseBoard, caseJourney, updateCaseStep } from "@/server/services/caseBoard";
import { caseComments, markQuestionnaireReady, postCaseComment, questionnaireView, saveQuestionnaire, sendToParalegal } from "@/server/services/questionnaire";
import { ALL_FIELDS, cleanAnswers, questionnaireStage } from "@/lib/intakeQuestionnaire";
import type { Actor, Lead } from "@/server/types";

const NOW = new Date("2026-11-26T15:00:00Z");
const DAY = 86_400_000;
const user = (id: string): Actor => actorFor(DEMO_USERS.find((u) => u.id === id)!, true);

let db: Db;
const attorneyA = () => user("u-lawyer-a");
const para = () => user("u-paralegal");
const para2: Actor = { userId: "u-para-2", role: "paralegal", firmId: DEMO_FIRM_ID, supportsLawyerIds: ["lawyer-a"], mfa: true };

async function acceptedLead(id: string, stage: Lead["stage"], extra: Partial<Lead> = {}): Promise<Lead> {
  const base = (await db.leads.get("lead-0001"))!;
  const lead: Lead = {
    ...structuredClone(base),
    id,
    stage,
    stageHistory: [{ stage, at: new Date(NOW.getTime() - 2 * DAY).toISOString(), by: "u-intake" }],
    firmId: DEMO_FIRM_ID,
    assignedLawyerId: "lawyer-a",
    ...extra,
  };
  return db.leads.insert(lead);
}

beforeEach(async () => {
  db = createMemoryDb();
  await seedDemo(db, NOW);
  await db.users.insert({ id: "u-para-2", email: "para2@example.com", name: "Drew Paralegal", role: "paralegal", firmId: DEMO_FIRM_ID, supportsLawyerIds: ["lawyer-a"], active: true });
  await acceptedLead("case-paid", "paid", { assignedParalegalId: "u-paralegal" });
  await acceptedLead("case-consult", "consult_booked", { assignedParalegalId: "u-para-2" });
  await acceptedLead("case-open", "retainer_signed");
});

describe("buildJourney", () => {
  it("follows the pipeline stage up to payment, then the legal steps", () => {
    const j = buildJourney({ stage: "paid", stageHistory: [{ stage: "paid", at: NOW.toISOString(), by: "x" }], createdAt: NOW.toISOString() }, NOW);
    expect(j.current?.key).toBe("documents_gathered");
    expect(j.phase).toBe("drafting");
    expect(j.steps.filter((s) => s.state === "done").map((s) => s.key)).toEqual(["received", "contacted", "qualified", "matched", "consult_booked", "consult_held", "retainer_sent", "retainer_signed", "paid"]);
    expect(nextActionLabel(j)).toBe("Gather the client's information");
  });

  it("flags a case stuck past the step's time limit", () => {
    const at = new Date(NOW.getTime() - 10 * DAY).toISOString();
    const j = buildJourney({ stage: "consult_held", stageHistory: [{ stage: "consult_held", at, by: "x" }], createdAt: at }, NOW);
    expect(j.current?.key).toBe("retainer_sent");
    expect(j.daysInStep).toBe(10);
    expect(j.stale).toBe(true);
  });

  it("shows every step done once the plan is complete, and a stopped step when the case exited", () => {
    const done = buildJourney({ stage: "plan_complete", stageHistory: [], createdAt: NOW.toISOString() }, NOW);
    expect(done.closed).toBe(true);
    expect(done.percent).toBe(100);
    const lost = buildJourney({ stage: "consult_held", stageHistory: [], createdAt: NOW.toISOString(), exit: { reason: "chose_another_option", at: NOW.toISOString() } }, NOW);
    expect(lost.phase).toBe("exited");
    expect(lost.current?.state).toBe("stopped");
    expect(nextActionLabel(lost)).toMatch(/chose another option/);
  });
});

describe("case board access", () => {
  it("shows a paralegal only the cases assigned to them", async () => {
    const ids = (b: Awaited<ReturnType<typeof caseBoard>>) => b.columns.flatMap((c) => c.cards.map((x) => x.leadId)).sort();
    expect(ids(await caseBoard(db, para(), {}, NOW))).toEqual(["case-paid"]);
    expect(ids(await caseBoard(db, para2, {}, NOW))).toEqual(["case-consult"]);
    expect(ids(await caseBoard(db, attorneyA(), {}, NOW))).toEqual(["case-consult", "case-open", "case-paid"]);
    await expect(caseJourney(db, para(), "case-open", NOW)).rejects.toThrow(ForbiddenError);
  });

  it("keeps intake, marketing and clients off the board", async () => {
    for (const id of ["u-intake", "u-marketing"]) await expect(caseBoard(db, user(id), {}, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("puts each case in its phase column, with counts and an unassigned filter", async () => {
    const board = await caseBoard(db, attorneyA(), {}, NOW);
    const col = (k: string) => board.columns.find((c) => c.key === k)!.cards.map((c) => c.leadId);
    expect(col("consult")).toEqual(["case-consult"]);
    expect(col("retainer")).toEqual(["case-open"]);
    expect(col("drafting")).toEqual(["case-paid"]);
    expect(board.counts.unassigned).toBe(1);
    const none = await caseBoard(db, attorneyA(), { paralegalId: "none" }, NOW);
    expect(none.columns.flatMap((c) => c.cards.map((x) => x.leadId))).toEqual(["case-open"]);
  });
});

describe("assigning a paralegal", () => {
  it("lets the attorney assign, and the paralegal then sees the case", async () => {
    await assignParalegal(db, attorneyA(), "case-open", "u-paralegal", NOW);
    expect((await caseJourney(db, para(), "case-open", NOW)).card.paralegalName).toBe("Casey Paralegal");
    const trail = await db.audit.list((e) => e.action === "case.paralegal");
    expect(trail).toHaveLength(1);
  });

  it("does not let a paralegal assign cases, even their own", async () => {
    await expect(assignParalegal(db, para(), "case-paid", "u-para-2", NOW)).rejects.toThrow(ForbiddenError);
  });

  it("refuses someone who is not an active paralegal at the case's firm", async () => {
    await expect(assignParalegal(db, attorneyA(), "case-open", "u-intake", NOW)).rejects.toThrow(/active paralegal/);
    await db.users.insert({ id: "u-para-x", email: "x@example.com", name: "Other Firm", role: "paralegal", firmId: "firm-other", active: true });
    await expect(assignParalegal(db, attorneyA(), "case-open", "u-para-x", NOW)).rejects.toThrow(/another firm/);
  });
});

describe("ticking off journey steps", () => {
  it("goes in order and moves the pipeline stage where a step maps to one", async () => {
    await expect(updateCaseStep(db, para(), "case-paid", "drafted", "done", undefined, NOW)).rejects.toThrow(/Finish that step first/);
    let lead = await updateCaseStep(db, para(), "case-paid", "documents_gathered", "done", "Deeds and account list in", NOW);
    expect(lead.stage).toBe("drafting");
    expect(lead.caseSteps?.documents_gathered).toMatchObject({ status: "done", by: "u-paralegal", note: "Deeds and account list in" });
    lead = await updateCaseStep(db, para(), "case-paid", "drafted", "done", undefined, NOW);
    expect(buildJourney(lead, NOW).current?.key).toBe("attorney_review");
  });

  it("leaves attorney review to the attorney", async () => {
    await updateCaseStep(db, para(), "case-paid", "documents_gathered", "done", undefined, NOW);
    await updateCaseStep(db, para(), "case-paid", "drafted", "done", undefined, NOW);
    await expect(updateCaseStep(db, para(), "case-paid", "attorney_review", "done", undefined, NOW)).rejects.toThrow(/Only the attorney/);
    expect((await caseJourney(db, para(), "case-paid", NOW)).canComplete).toBeUndefined();
    const lead = await updateCaseStep(db, attorneyA(), "case-paid", "attorney_review", "done", undefined, NOW);
    expect(lead.caseSteps?.attorney_review?.by).toBe("u-lawyer-a");
  });

  it("lets funding be skipped when there is no trust, and closes the case", async () => {
    for (const [who, step] of [[para(), "documents_gathered"], [para(), "drafted"], [attorneyA(), "attorney_review"], [para(), "client_review"], [para(), "signed"]] as const) {
      await updateCaseStep(db, who, "case-paid", step, "done", undefined, NOW);
    }
    await expect(updateCaseStep(db, para(), "case-paid", "signed", "skip", undefined, NOW)).rejects.toThrow();
    await updateCaseStep(db, para(), "case-paid", "funded", "skip", "Will-only plan", NOW);
    await updateCaseStep(db, para(), "case-paid", "delivered", "done", "Originals handed over", NOW);
    // closing the file is the attorney's call
    await expect(updateCaseStep(db, para(), "case-paid", "closed", "done", undefined, NOW)).rejects.toThrow(/Only the attorney/);
    const lead = await updateCaseStep(db, attorneyA(), "case-paid", "closed", "done", undefined, NOW);
    expect(lead.stage).toBe("plan_complete");
    const j = buildJourney(lead, NOW);
    expect(j.closed).toBe(true);
    expect(j.steps.find((s) => s.key === "funded")?.state).toBe("skipped");
  });

  it("undoes only the most recent legal step", async () => {
    await updateCaseStep(db, para(), "case-paid", "documents_gathered", "done", undefined, NOW);
    await updateCaseStep(db, para(), "case-paid", "drafted", "done", undefined, NOW);
    await expect(updateCaseStep(db, para(), "case-paid", "documents_gathered", "undo", undefined, NOW)).rejects.toThrow(/most recent/);
    const lead = await updateCaseStep(db, para(), "case-paid", "drafted", "undo", undefined, NOW);
    expect(lead.caseSteps?.drafted).toBeUndefined();
    expect(buildJourney(lead, NOW).current?.key).toBe("drafted");
  });

  it("moves pipeline steps through setStage, audited", async () => {
    const lead = await updateCaseStep(db, attorneyA(), "case-consult", "consult_held", "done", undefined, NOW);
    expect(lead.stage).toBe("consult_held");
    expect((await db.audit.list((e) => e.action === "case.step" && e.leadId === "case-consult")).length).toBe(1);
  });

  it("does not let another paralegal touch the case", async () => {
    await expect(updateCaseStep(db, para2, "case-paid", "documents_gathered", "done", undefined, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("covers every step with a stage or a legal key", () => {
    for (const s of JOURNEY_STEPS) expect(Boolean(s.doneAtStage) !== Boolean(s.legal), s.key).toBe(true);
  });
});

const FULL: Record<string, string> = Object.fromEntries(
  ALL_FIELDS.filter((f) => f.required).map((f) => [f.id, f.type === "select" ? f.options![0] : f.type === "yesno" ? "Yes" : "Filled in"]),
);

describe("intake questionnaire", () => {
  it("starts from what intake knows and keeps only known, valid answers", async () => {
    const v = await questionnaireView(db, attorneyA(), "case-open", NOW);
    expect(v.prefilled).toBe(true);
    expect(v.answers.client_full_name).toBe("Taylor Rivera");
    expect(v.answers.spouse_name).toBe("Jamie Rivera");
    expect(cleanAnswers({ marital_status: "Married", bogus: "x", joint_plan: "maybe", client_dob: "not a date" })).toEqual({ marital_status: "Married" });
  });

  it("goes attorney -> paralegal -> ready -> signed off, with the hand-offs on the thread", async () => {
    await saveQuestionnaire(db, attorneyA(), "case-open", { client_full_name: "Taylor Rivera" }, NOW);
    expect(questionnaireStage((await db.leads.get("case-open"))!)).toBe("attorney");
    // the paralegal cannot see the unassigned case yet
    await expect(questionnaireView(db, para(), "case-open", NOW)).rejects.toThrow(ForbiddenError);
    await sendToParalegal(db, attorneyA(), "case-open", "u-paralegal", "Collect the deed please", NOW);
    let lead = (await db.leads.get("case-open"))!;
    expect(lead.assignedParalegalId).toBe("u-paralegal");
    expect(questionnaireStage(lead)).toBe("paralegal");
    const v = await questionnaireView(db, para(), "case-open", NOW);
    expect(v.canEdit).toBe(true);
    expect(v.canSend).toBe(false);
    expect(v.comments.map((c) => c.body)[0]).toMatch(/Sent the intake questionnaire to Casey Paralegal[\s\S]*Collect the deed/);
    // not ready while required answers are empty
    await expect(markQuestionnaireReady(db, para(), "case-open", undefined, NOW)).rejects.toThrow(/required/);
    await saveQuestionnaire(db, para(), "case-open", FULL, NOW);
    await postCaseComment(db, para(), "case-open", "Deed received", NOW);
    await markQuestionnaireReady(db, para(), "case-open", undefined, NOW);
    lead = (await db.leads.get("case-open"))!;
    expect(questionnaireStage(lead)).toBe("ready_for_review");
    // the attorney sees the whole thread
    expect((await caseComments(db, attorneyA(), "case-open")).map((c) => c.authorId)).toEqual(["u-lawyer-a", "u-paralegal", "u-paralegal"]);
  });

  it("ticks off 'Info + documents gathered' when marked ready on that step, and locks after attorney review", async () => {
    await saveQuestionnaire(db, attorneyA(), "case-paid", FULL, NOW);
    await sendToParalegal(db, attorneyA(), "case-paid", "u-paralegal", undefined, NOW);
    const lead = await markQuestionnaireReady(db, para(), "case-paid", undefined, NOW);
    expect(lead.caseSteps?.documents_gathered?.note).toBe("Intake questionnaire complete");
    await updateCaseStep(db, para(), "case-paid", "drafted", "done", undefined, NOW);
    await updateCaseStep(db, attorneyA(), "case-paid", "attorney_review", "done", undefined, NOW);
    expect(questionnaireStage((await db.leads.get("case-paid"))!)).toBe("signed_off");
    await expect(saveQuestionnaire(db, para(), "case-paid", FULL, NOW)).rejects.toThrow(/locked/);
    expect((await questionnaireView(db, para(), "case-paid", NOW)).canEdit).toBe(false);
  });

  it("lets only the attorney side send, and keeps the office read-only", async () => {
    await saveQuestionnaire(db, attorneyA(), "case-paid", { client_full_name: "X" }, NOW);
    await expect(sendToParalegal(db, para(), "case-paid", "u-para-2", undefined, NOW)).rejects.toThrow(ForbiddenError);
    await expect(saveQuestionnaire(db, user("u-firmadmin"), "case-paid", FULL, NOW)).rejects.toThrow(ForbiddenError);
    expect((await questionnaireView(db, user("u-firmadmin"), "case-paid", NOW)).canSend).toBe(true);
    await expect(saveQuestionnaire(db, para2, "case-paid", FULL, NOW)).rejects.toThrow(ForbiddenError);
  });

  it("changes only the fields sent, so a partial save keeps the rest", async () => {
    await saveQuestionnaire(db, attorneyA(), "case-open", { client_full_name: "Taylor Rivera", children: "Two" }, NOW);
    const lead = await saveQuestionnaire(db, attorneyA(), "case-open", { children: "" , home: "Condo" }, NOW);
    expect(lead.questionnaire?.answers).toEqual({ client_full_name: "Taylor Rivera", home: "Condo" });
  });

  it("records which fields changed in the audit log, never the answers", async () => {
    await saveQuestionnaire(db, attorneyA(), "case-open", { client_full_name: "Secret Name", attorney_notes: "private" }, NOW);
    const ev = (await db.audit.list((e) => e.action === "questionnaire.save")).at(-1)!;
    expect(ev.detail).toEqual({ fields: expect.arrayContaining(["client_full_name", "attorney_notes"]) });
    expect(JSON.stringify(ev)).not.toContain("Secret Name");
  });
});
