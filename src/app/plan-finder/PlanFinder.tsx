"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ConsultScheduler from "@/components/ConsultScheduler";
import LeadForm, { type LeadResponse } from "@/components/LeadForm";
import { track } from "@/components/capture";
import { US_STATES } from "@/config/firm";
import {
  isServedState,
  likelyPackage,
  planFinderSteps,
  pruneAnswers,
  SITUATION_IDS,
  SITUATION_LABELS,
  type Answers,
} from "@/lib/planFinder";
import { educationTopics, QUESTIONS, type QuizAnswers } from "@/lib/quiz";
import { loadVisitor } from "@/lib/visitor";

type Phase = "questions" | "out_of_area" | "result" | "contact" | "done";

/**
 * Plan finder (L7): state first, about seven short steps, then the result before any contact
 * details. Contact details are asked only when the visitor chooses to book a consult.
 * Analytics events carry step numbers and placement only, never answers or contact details.
 */
export default function PlanFinder({ servedStates }: { servedStates: string[] }) {
  const [phase, setPhase] = useState<Phase>("questions");
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [done, setDone] = useState<LeadResponse | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    const known = loadVisitor()?.contact.state;
    if (known) setState(known);
  }, []);

  // Move focus to the new step's heading so screen reader and keyboard users land on the question.
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [phase, stepIndex]);

  const steps = planFinderSteps(answers);
  const step = steps[stepIndex];

  function go(nextPhase: Phase, nextIndex = stepIndex) {
    moved.current = true;
    setPhase(nextPhase);
    setStepIndex(nextIndex);
  }

  function next(a: Answers = answers) {
    const list = planFinderSteps(a);
    track("plan_finder_step", { step: stepIndex + 1, of: list.length });
    if (stepIndex + 1 < list.length) {
      go("questions", stepIndex + 1);
    } else {
      setAnswers(pruneAnswers(a));
      track("plan_finder_result");
      go("result");
    }
  }

  function submitState() {
    if (!state) return;
    if (!isServedState(state, servedStates)) {
      track("plan_finder_out_of_area");
      go("out_of_area");
      return;
    }
    next();
  }

  function choose(id: keyof QuizAnswers, value: string, advance: boolean) {
    const a = { ...answers, [id]: value } as Answers;
    setAnswers(a);
    if (advance) next(a);
  }

  function nextFromSituations() {
    const a = { ...answers };
    for (const id of SITUATION_IDS) if (a[id] !== "yes") a[id] = "no";
    setAnswers(a);
    next(a);
  }

  const back = (
    <button type="button" className="button secondary" onClick={() => go("questions", Math.max(stepIndex - 1, 0))}>Back</button>
  );

  if (phase === "out_of_area") {
    return (
      <section>
        <h1 ref={headingRef} tabIndex={-1}>We are not able to help in {state} yet</h1>
        <p className="lead">
          Estate planning documents follow the law of the state you live in, so you want an attorney licensed there.
          We only practice in {servedStates.join(", ")}.
        </p>
        <p>
          <Link href="/not-in-your-state">Here is how to find a licensed estate planning attorney where you live.</Link>{" "}
          Our <Link href="/guides">guides</Link> and <Link href="/checklists">checklists</Link> are free to use wherever
          you live, and they can help you get ready for that meeting.
        </p>
        <div className="nav">
          <button type="button" className="button secondary" onClick={() => go("questions", 0)}>Change my state</button>
          <span />
        </div>
      </section>
    );
  }

  if (phase === "done" && done) {
    return (
      <section aria-live="polite">
        <h1 ref={headingRef} tabIndex={-1}>Thank you. We have your request.</h1>
        {done.served ? (
          <ConsultScheduler />
        ) : (
          <p className="lead">
            We are not able to help in your state yet.{" "}
            <Link href="/not-in-your-state">Here is how to find a licensed estate planning attorney where you live.</Link>
          </p>
        )}
        <p className="notice">This is general information, not legal advice about your situation.</p>
      </section>
    );
  }

  if (phase === "result" || phase === "contact") {
    const topics = educationTopics(answers);
    const pkg = likelyPackage(answers);
    return (
      <>
        <section>
          <h1 ref={phase === "result" ? headingRef : undefined} tabIndex={-1}>Your results</h1>
          <h2>Topics people in a similar situation often discuss with an attorney</h2>
          {topics.map((t) => (
            <div className="card" key={t.title} style={{ marginBottom: 12 }}>
              <strong>{t.title}</strong>
              <p style={{ margin: "4px 0 0" }}>{t.body}</p>
            </div>
          ))}
          {pkg && (
            <>
              <h2>A common starting point: our {pkg.name} package</h2>
              <p>
                {pkg.for} The attorney confirms what fits at your consult. See what each package costs on our{" "}
                <Link href="/pricing">pricing page</Link>.
              </p>
              <ul>
                {pkg.includes.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </>
          )}
          <p className="notice">This is general information, not legal advice about your situation.</p>
        </section>
        {phase === "result" ? (
          <section>
            <h2>Want to talk it through with an attorney?</h2>
            <div className="nav">
              <button type="button" className="button secondary" onClick={() => go("questions", steps.length - 1)}>Back</button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  track("cta_book", { from: "plan_finder_result" });
                  go("contact");
                }}
              >
                Book a consult
              </button>
            </div>
            <p>
              Not ready yet? Browse our <Link href="/guides">guides</Link> and <Link href="/tools">tools</Link>.
            </p>
          </section>
        ) : (
          <section>
            <h2 ref={headingRef} tabIndex={-1}>Book a consult</h2>
            <LeadForm
              tool="plan_finder"
              answers={answers}
              legend="How can we reach you to set up your consult?"
              submitLabel="Request my consult"
              defaultState={state}
              askLastName
              askPreferredContact
              askGoals
              askHeardFrom
              onBack={() => go("result")}
              onSuccess={(data) => {
                track("lead_capture", { kind: "consult", from: "plan_finder" });
                setDone(data);
                go("done");
              }}
            />
          </section>
        )}
      </>
    );
  }

  const question = step?.kind === "single" ? QUESTIONS.find((q) => q.id === step.id) : undefined;

  return (
    <>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.round((stepIndex / steps.length) * 100)}%` }} />
      </div>
      <p className="notice">Step {stepIndex + 1} of {steps.length}</p>

      {step?.kind === "state" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitState();
          }}
        >
          <fieldset>
            <legend>
              <h1 ref={headingRef} tabIndex={-1} style={{ margin: 0, fontSize: "inherit" }}>Which state do you live in?</h1>
            </legend>
            <p className="notice">Estate plans follow the law of your home state, so we check this first.</p>
            <label className="field">
              State
              <select name="state" required value={state} onChange={(e) => setState(e.target.value)}>
                <option value="" disabled>Choose a state</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <div className="nav">
              <span />
              <button type="submit" className="button" disabled={!state}>Next</button>
            </div>
          </fieldset>
        </form>
      )}

      {question && (
        <fieldset>
          <legend>
            <h1 ref={headingRef} tabIndex={-1} style={{ margin: 0, fontSize: "inherit" }}>{question.prompt}</h1>
          </legend>
          {question.help && <p className="notice">{question.help}</p>}
          {question.options.map((o) => (
            <label className="option" key={o.value}>
              <input
                type="radio"
                name={question.id}
                value={o.value}
                checked={answers[question.id] === o.value}
                onChange={() => choose(question.id, o.value, false)}
                // A pointer click moves on right away. Arrow keys only select, so keyboard users press Next.
                onClick={(e) => e.detail > 0 && choose(question.id, o.value, true)}
              />
              <span>{o.label}</span>
            </label>
          ))}
          <div className="nav">
            {back}
            <button type="button" className="button" disabled={!answers[question.id]} onClick={() => next()}>Next</button>
          </div>
        </fieldset>
      )}

      {step?.kind === "situations" && (
        <fieldset>
          <legend>
            <h1 ref={headingRef} tabIndex={-1} style={{ margin: 0, fontSize: "inherit" }}>Do any of these apply to you?</h1>
          </legend>
          <p className="notice">Check all that apply, or none.</p>
          {SITUATION_IDS.map((id) => (
            <label className="option" key={id}>
              <input
                type="checkbox"
                name={id}
                checked={answers[id] === "yes"}
                onChange={(e) => setAnswers((a) => ({ ...a, [id]: e.target.checked ? "yes" : "no" }))}
              />
              <span>{SITUATION_LABELS[id]}</span>
            </label>
          ))}
          <div className="nav">
            {back}
            <button type="button" className="button" onClick={nextFromSituations}>Next</button>
          </div>
        </fieldset>
      )}
    </>
  );
}
