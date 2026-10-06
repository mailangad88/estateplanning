"use client";

import { useState } from "react";
import LeadForm, { type LeadResponse } from "@/components/LeadForm";
import { firm } from "@/config/firm";
import { QUESTIONS, type QuizAnswers } from "@/lib/quiz";

type Answers = Partial<QuizAnswers>;

/** Easy tap questions first, contact details last: each step is two or three questions at most. */
const STEPS: { title: string; ids: (keyof QuizAnswers)[] }[] = [
  { title: "What can we help with?", ids: ["matterType"] },
  { title: "About your family", ids: ["maritalStatus", "children", "blendedFamily"] },
  { title: "About what you own", ids: ["ownsHome", "ownsBusiness", "assetRange"] },
  { title: "Timing and how you'd like to meet", ids: ["existingDocuments", "urgency"] },
];

const MEETING = [
  { value: "phone", label: "Phone" },
  { value: "video", label: "Video call" },
  { value: "office", label: "In the office" },
];
const TIMES = [
  { value: "morning", label: "Mornings" },
  { value: "afternoon", label: "Afternoons" },
  { value: "evening", label: "Early evenings" },
];

export default function Intake() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [meetingType, setMeetingType] = useState("phone");
  const [bestTime, setBestTime] = useState("morning");
  const [done, setDone] = useState<LeadResponse | null>(null);
  const total = STEPS.length + 1;

  if (done) {
    return (
      <section aria-live="polite">
        <h1>Thank you. We have your request.</h1>
        {done.served ? (
          <p className="lead">
            Someone from our intake team will contact you during office hours ({firm.hours}) to set up your consult.
            If anything is urgent, call {firm.phone}.
          </p>
        ) : (
          <p className="lead">
            We are not able to help in your state yet. Your state bar&apos;s lawyer referral service can connect you
            with a licensed estate planning attorney near you.
          </p>
        )}
      </section>
    );
  }

  const current = STEPS[step];
  const stepComplete = current ? current.ids.every((id) => answers[id]) : true;

  return (
    <>
      <h1>Book a consult</h1>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.round(((step + 1) / total) * 100)}%` }} />
      </div>
      <p className="notice">Step {step + 1} of {total}. Your answers help the attorney prepare, so the consult is useful.</p>

      {current ? (
        <fieldset>
          <legend>{current.title}</legend>
          {current.ids.map((id) => {
            const q = QUESTIONS.find((x) => x.id === id)!;
            return (
              <div className="question" key={id} role="radiogroup" aria-label={q.prompt}>
                <p>{q.prompt}</p>
                {q.help && <p className="notice">{q.help}</p>}
                <div className="inline-options">
                  {q.options.map((o) => (
                    <label className="option" key={o.value}>
                      <input type="radio" name={id} value={o.value} checked={answers[id] === o.value}
                        onChange={() => setAnswers((a) => ({ ...a, [id]: o.value }))} />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {step === STEPS.length - 1 && (
            <>
              <div className="question">
                <p>How would you like to meet?</p>
                <div className="inline-options">
                  {MEETING.map((m) => (
                    <label className="option" key={m.value}>
                      <input type="radio" name="meetingType" checked={meetingType === m.value} onChange={() => setMeetingType(m.value)} />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="question">
                <p>When is usually best for you?</p>
                <div className="inline-options">
                  {TIMES.map((t) => (
                    <label className="option" key={t.value}>
                      <input type="radio" name="bestTime" checked={bestTime === t.value} onChange={() => setBestTime(t.value)} />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="nav">
            {step > 0 ? <button type="button" className="button secondary" onClick={() => setStep(step - 1)}>Back</button> : <span />}
            <button type="button" className="button" disabled={!stepComplete} onClick={() => setStep(step + 1)}>Next</button>
          </div>
        </fieldset>
      ) : (
        <LeadForm
          tool="intake"
          answers={answers}
          result={{ meetingType, bestTime }}
          legend="How can we reach you to schedule?"
          submitLabel="Request my consult"
          askLastName
          askCounty
          askPreferredContact
          askGoals
          goalsLabel="What would you like to get done? (optional)"
          onBack={() => setStep(step - 1)}
          onSuccess={setDone}
        />
      )}
    </>
  );
}
