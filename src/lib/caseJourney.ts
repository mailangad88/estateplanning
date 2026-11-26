/**
 * The lead-to-close journey of an estate planning case, as one ordered list of steps.
 *
 * The first steps (lead in, first contact, consult, retainer) follow the lead's pipeline stage, which the
 * intake queue, routing and e-sign flows already move. The legal steps after the fee is paid (documents
 * gathered, drafting, attorney review, client review, signing, funding, closed) are ticked off by the case
 * team and kept on the lead as `caseSteps`. Completing some of them also moves the stage, so the pipeline,
 * the case board and every report agree.
 *
 * Pure: no database, so the page, the API and tests share it.
 */
import type { CaseStepKey, CaseStepRecord, Lead, Stage } from "@/server/types";

export const CASE_PHASES = [
  { key: "lead", label: "Lead", tone: "sand" },
  { key: "consult", label: "Consult", tone: "gold" },
  { key: "retainer", label: "Retainer", tone: "terracotta" },
  { key: "drafting", label: "Drafting", tone: "teal" },
  { key: "signing", label: "Signing & funding", tone: "sage" },
  { key: "closed", label: "Closed", tone: "deep" },
] as const;
export type CasePhase = (typeof CASE_PHASES)[number]["key"];

export interface JourneyStepDef {
  key: string;
  label: string;
  /** What "done" means, shown under the step */
  hint: string;
  phase: CasePhase;
  /** Steps that follow the pipeline stage: done once the lead reaches this stage */
  doneAtStage?: Stage;
  /** Legal steps the case team ticks off */
  legal?: CaseStepKey;
  /** Only the attorney (or a platform admin) can tick it off */
  attorneyOnly?: boolean;
  /** Can be marked "not needed" (e.g. no trust to fund) */
  skippable?: boolean;
  /** Days in this step before the board flags it as stuck */
  staleAfterDays: number;
}

export const JOURNEY_STEPS: JourneyStepDef[] = [
  { key: "received", label: "Lead received", hint: "Came in from the website or a call", phase: "lead", doneAtStage: "new", staleAfterDays: 1 },
  { key: "contacted", label: "First contact", hint: "Someone spoke with them", phase: "lead", doneAtStage: "contacted", staleAfterDays: 2 },
  { key: "qualified", label: "Qualified + conflict check", hint: "Right fit, no conflict", phase: "lead", doneAtStage: "qualified", staleAfterDays: 3 },
  { key: "matched", label: "Attorney matched", hint: "An attorney accepted the case", phase: "lead", doneAtStage: "accepted", staleAfterDays: 2 },
  { key: "consult_booked", label: "Consult booked", hint: "On the calendar", phase: "consult", doneAtStage: "consult_booked", staleAfterDays: 7 },
  { key: "consult_held", label: "Consult held", hint: "Met with the attorney", phase: "consult", doneAtStage: "consult_held", staleAfterDays: 3 },
  { key: "retainer_sent", label: "Retainer sent", hint: "Engagement letter out for signature", phase: "retainer", doneAtStage: "proposal_sent", staleAfterDays: 5 },
  { key: "retainer_signed", label: "Retainer signed", hint: "Client signed the engagement", phase: "retainer", doneAtStage: "retainer_signed", staleAfterDays: 3 },
  { key: "paid", label: "Fee paid", hint: "First payment received", phase: "retainer", doneAtStage: "paid", staleAfterDays: 3 },
  { key: "documents_gathered", label: "Info + documents gathered", hint: "Questionnaire, deeds, account list in", phase: "drafting", legal: "documents_gathered", staleAfterDays: 7 },
  { key: "drafted", label: "Documents drafted", hint: "Will, trust, POAs drafted", phase: "drafting", legal: "drafted", staleAfterDays: 7 },
  { key: "attorney_review", label: "Attorney review", hint: "Attorney checked and approved the drafts", phase: "drafting", legal: "attorney_review", attorneyOnly: true, staleAfterDays: 3 },
  { key: "client_review", label: "Client review (1 revision)", hint: "Client read the drafts; one round of changes", phase: "drafting", legal: "client_review", staleAfterDays: 7 },
  { key: "signed", label: "Signing ceremony", hint: "Signed with witnesses and notary", phase: "signing", legal: "signed", staleAfterDays: 14 },
  { key: "funded", label: "Trust funding", hint: "Deeds and accounts retitled to the trust", phase: "signing", legal: "funded", skippable: true, staleAfterDays: 21 },
  { key: "closed", label: "Closed", hint: "Originals delivered, file closed", phase: "closed", legal: "closed", staleAfterDays: 9999 },
];

export const LEGAL_STEP_KEYS = JOURNEY_STEPS.filter((s) => s.legal).map((s) => s.legal!) as CaseStepKey[];

/** Completing these legal steps moves the lead's pipeline stage, so other screens agree. */
export const STAGE_AFTER_LEGAL: Partial<Record<CaseStepKey, Stage>> = {
  documents_gathered: "drafting",
  client_review: "signing_scheduled",
  closed: "plan_complete",
};

const STAGE_ORDER: Stage[] = [
  "new", "contacted", "qualified", "conflict_check", "offered", "accepted", "consult_booked", "consult_held",
  "proposal_sent", "retainer_signed", "paid", "drafting", "signing_scheduled", "plan_complete", "annual_review",
];
const rank = (s: Stage) => STAGE_ORDER.indexOf(s);

export type StepState = "done" | "skipped" | "current" | "upcoming" | "stopped";

export interface JourneyStep extends JourneyStepDef {
  state: StepState;
  /** When it was done (or skipped) */
  at?: string;
  by?: string;
  note?: string;
}

export interface Journey {
  steps: JourneyStep[];
  /** Index of the step the case is on (the first not done); steps.length when closed */
  currentIndex: number;
  current?: JourneyStep;
  phase: CasePhase | "exited";
  done: number;
  total: number;
  /** 0-100 */
  percent: number;
  /** When the case reached the current step */
  since: string;
  daysInStep: number;
  stale: boolean;
  closed: boolean;
  exited?: { reason: string; at: string };
}

const DAY = 86_400_000;

/** When the lead first reached `stage` or any later stage, from its history. */
function reachedAt(lead: Pick<Lead, "stageHistory" | "createdAt">, stage: Stage): string | undefined {
  if (stage === "new") return lead.createdAt;
  const hit = lead.stageHistory.find((h) => rank(h.stage) >= rank(stage));
  return hit?.at;
}

export function buildJourney(lead: Pick<Lead, "stage" | "stageHistory" | "createdAt" | "exit" | "caseSteps">, now = new Date()): Journey {
  const steps = lead.caseSteps ?? {};
  const finished = rank(lead.stage) >= rank("plan_complete");
  let currentIndex = -1;
  const out: JourneyStep[] = JOURNEY_STEPS.map((def, i) => {
    let state: StepState = "upcoming";
    let at: string | undefined;
    let by: string | undefined;
    let note: string | undefined;
    if (def.doneAtStage) {
      if (rank(lead.stage) >= rank(def.doneAtStage)) {
        state = "done";
        at = reachedAt(lead, def.doneAtStage);
      }
    } else if (def.legal) {
      const rec: CaseStepRecord | undefined = steps[def.legal];
      if (rec) {
        state = rec.status;
        at = rec.at;
        by = rec.by;
        note = rec.note;
      } else if (finished) {
        state = "done";
      }
    }
    if (state === "upcoming" && currentIndex < 0) {
      currentIndex = i;
      state = lead.exit ? "stopped" : "current";
    }
    return { ...def, state, at, by, note };
  });
  if (currentIndex < 0) currentIndex = out.length;
  const done = out.filter((s) => s.state === "done" || s.state === "skipped").length;
  const closed = currentIndex >= out.length;
  const prior = out.slice(0, currentIndex).reverse().find((s) => s.at);
  const since = lead.exit?.at ?? prior?.at ?? lead.createdAt;
  const daysInStep = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / DAY));
  const current = out[currentIndex];
  return {
    steps: out,
    currentIndex,
    current,
    phase: lead.exit ? "exited" : closed ? "closed" : current.phase,
    done,
    total: out.length,
    percent: Math.round((done / out.length) * 100),
    since,
    daysInStep,
    stale: !lead.exit && !closed && !!current && daysInStep >= current.staleAfterDays,
    closed,
    exited: lead.exit ? { reason: lead.exit.reason.replaceAll("_", " "), at: lead.exit.at } : undefined,
  };
}

/**
 * The step that can be ticked off next. Steps are done in order so the journey never shows "signed"
 * before "drafted". Pipeline steps (a consult held, a paper retainer signed in the office) can be ticked
 * here too; that moves the stage just as the intake queue or e-sign flow would.
 */
export function nextStep(journey: Journey): JourneyStep | undefined {
  const c = journey.current;
  return c && c.state === "current" ? c : undefined;
}

/** The last legal step that was ticked off, which is the only one that can be undone. */
export function lastLegalStep(journey: Journey, lead: Pick<Lead, "caseSteps">): JourneyStep | undefined {
  const recorded = journey.steps.filter((s) => s.legal && lead.caseSteps?.[s.legal]);
  return recorded[recorded.length - 1];
}

/** What the case team should do next, in plain words. */
export function nextActionLabel(journey: Journey): string {
  if (journey.exited) return `Closed early: ${journey.exited.reason}`;
  if (journey.closed) return "Case closed";
  const c = journey.current!;
  const todo: Record<string, string> = {
    contacted: "Make first contact",
    qualified: "Qualify and run the conflict check",
    matched: "Match an attorney",
    consult_booked: "Book the consult",
    consult_held: "Hold the consult",
    retainer_sent: "Send the retainer",
    retainer_signed: "Get the retainer signed",
    paid: "Collect the first payment",
    documents_gathered: "Gather the client's information",
    drafted: "Draft the documents",
    attorney_review: "Attorney reviews the drafts",
    client_review: "Client reviews the drafts",
    signed: "Hold the signing ceremony",
    funded: "Fund the trust",
    closed: "Deliver originals and close the file",
  };
  return todo[c.key] ?? c.label;
}
