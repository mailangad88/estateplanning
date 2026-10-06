"use client";

import Link from "next/link";
import { useState } from "react";
import LeadForm from "@/components/LeadForm";
import { QUESTIONS, type EducationTopic, type QuizAnswers } from "@/lib/quiz";

type Answers = Partial<QuizAnswers>;

export default function PlanFinder() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<{ served: boolean; topics: EducationTopic[] } | null>(null);

  const total = QUESTIONS.length + 1;
  const question = QUESTIONS[step];

  function choose(id: keyof QuizAnswers, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setStep((s) => s + 1);
  }

  if (result) {
    return (
      <section aria-live="polite">
        <h1>Thank you. Here is what to expect.</h1>
        {result.served ? (
          <p className="lead">A member of our intake team will reach out shortly to set up your consult.</p>
        ) : (
          <p className="lead">
            We are not able to help in your state yet. <a href="/not-in-your-state">Here is how to find a licensed
            estate planning attorney where you live.</a>
          </p>
        )}
        <h2>Topics people in a similar situation often discuss with an attorney</h2>
        {result.topics.map((t) => (
          <div className="card" key={t.title} style={{ marginBottom: 12 }}>
            <strong>{t.title}</strong>
            <p style={{ margin: "4px 0 0" }}>{t.body}</p>
          </div>
        ))}
        {result.served && (
          <p>
            Ready to talk now? <Link href="/intake">Pick a meeting type and time</Link>, or browse our{" "}
            <Link href="/resources">free guides</Link> while you wait.
          </p>
        )}
        <p className="notice">This is general information, not legal advice about your situation.</p>
      </section>
    );
  }

  return (
    <>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.round((step / total) * 100)}%` }} />
      </div>
      <p className="notice">Step {step + 1} of {total}</p>

      {question ? (
        <fieldset>
          <legend>{question.prompt}</legend>
          {question.help && <p className="notice">{question.help}</p>}
          {question.options.map((o) => (
            <label className="option" key={o.value}>
              <input
                type="radio"
                name={question.id}
                value={o.value}
                checked={answers[question.id] === o.value}
                onChange={() => choose(question.id, o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
          <div className="nav">
            {step > 0 ? (
              <button type="button" className="button secondary" onClick={() => setStep(step - 1)}>Back</button>
            ) : <span />}
          </div>
        </fieldset>
      ) : (
        <LeadForm
          tool="plan_finder"
          answers={answers}
          legend="Where should we send your results?"
          submitLabel="See my results"
          askLastName
          askCounty
          askPreferredContact
          askGoals
          onBack={() => setStep(step - 1)}
          onSuccess={(data) => setResult({ served: data.served, topics: data.topics })}
        />
      )}
    </>
  );
}
