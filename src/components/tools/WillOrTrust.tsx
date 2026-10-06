"use client";

import Link from "next/link";
import { useState } from "react";
import LeadForm, { type LeadResponse } from "@/components/LeadForm";
import ProbateVsTrustAnimation from "@/components/ProbateVsTrustAnimation";
import { WILL_VS_TRUST_QUESTIONS, weighWillVsTrust, type WillVsTrustResult } from "@/lib/tools/willVsTrust";

const GUIDE = "probate-vs-trust-guide";

export default function WillOrTrust() {
  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>({});
  const [result, setResult] = useState<WillVsTrustResult | null>(null);
  const [done, setDone] = useState<LeadResponse | null>(null);
  const answered = Object.keys(answers).length;

  if (result) {
    return (
      <>
        <h2>Will or trust: what your answers suggest</h2>
        <div className="result" aria-live="polite">
          <p className="big" style={{ fontSize: "1.6rem" }}>{result.headline}</p>
          <p className="notice">
            {result.trustReasons.length} of your answers are common reasons for a trust and {result.willReasons.length}{" "}
            are common reasons people start with a will.
          </p>
        </div>
        <ProbateVsTrustAnimation />
        {done ? (
          <>
            <div className="two-col">
              <div className="card">
                <strong>Reasons people choose a trust</strong>
                {result.trustReasons.length ? <ul>{result.trustReasons.map((r) => <li key={r}>{r}</li>)}</ul> : <p>None of your answers.</p>}
              </div>
              <div className="card">
                <strong>Reasons people start with a will</strong>
                {result.willReasons.length ? <ul>{result.willReasons.map((r) => <li key={r}>{r}</li>)}</ul> : <p>None of your answers.</p>}
              </div>
            </div>
            <p>
              {done.guideUrl && <>Your guide is ready: <Link href={done.guideUrl}>open the probate vs. trust guide</Link>. </>}
              Want to talk it through? <Link href="/intake">Book a consult</Link>.
            </p>
          </>
        ) : (
          <LeadForm
            tool="will_vs_trust"
            resource={GUIDE}
            result={{ lean: result.lean, trustPoints: result.trustPoints, willPoints: result.willPoints }}
            legend="See the full breakdown"
            why="We'll show each factor behind your result here and send you our plain-English probate vs. trust guide."
            submitLabel="Show my breakdown"
            onBack={() => setResult(null)}
            onSuccess={setDone}
          />
        )}
        <p className="notice">General information only. Which is right for you depends on your state and situation.</p>
      </>
    );
  }

  return (
    <>
      <h2>Will or trust?</h2>
      <p className="lead">Ten yes-or-no questions. See which way your answers point.</p>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.round((answered / WILL_VS_TRUST_QUESTIONS.length) * 100)}%` }} />
      </div>
      {WILL_VS_TRUST_QUESTIONS.map((q) => (
        <fieldset className="question" key={q.id}>
          <legend style={{ fontSize: "1rem" }}>{q.prompt}</legend>
          <div className="inline-options">
            {(["yes", "no"] as const).map((v) => (
              <label className="option" key={v}>
                <input type="radio" name={q.id} value={v} checked={answers[q.id] === v} onChange={() => setAnswers((a) => ({ ...a, [q.id]: v }))} />
                <span>{v === "yes" ? "Yes" : "No"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="nav">
        <span className="notice">{answered} of {WILL_VS_TRUST_QUESTIONS.length} answered</span>
        <button type="button" className="button" disabled={answered < WILL_VS_TRUST_QUESTIONS.length} onClick={() => setResult(weighWillVsTrust(answers))}>
          See my result
        </button>
      </div>
    </>
  );
}
