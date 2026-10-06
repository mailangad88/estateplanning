"use client";

import { useState } from "react";
import Link from "next/link";
import { EmailCapture, track } from "@/components/capture";

export const READINESS_QUESTIONS = [
  { id: "will", q: "I have a signed will or trust.", weight: 15, gap: "No will or trust: state law would decide who inherits.", link: "/guides/how-to-make-a-will" },
  { id: "recent", q: "My documents were signed or reviewed in the last 5 years.", weight: 8, gap: "Documents more than 5 years old often miss life and law changes.", link: "/guides/updating-your-estate-plan" },
  { id: "guardian", q: "If I have minor children, I have named a guardian in writing (check if no minor children).", weight: 12, gap: "No written guardian choice for minor children.", link: "/guides/guardianship-for-minor-children" },
  { id: "poa", q: "I have a financial power of attorney.", weight: 10, gap: "No financial power of attorney: family may need a court to manage your money.", link: "/guides/powers-of-attorney" },
  { id: "health", q: "I have a healthcare power of attorney and a living will.", weight: 10, gap: "No healthcare decision-maker or written wishes.", link: "/guides/healthcare-directives-and-living-wills" },
  { id: "hipaa", q: "I have signed a HIPAA release.", weight: 4, gap: "Without a HIPAA release, doctors may not share information with family.", link: "/glossary#hipaa-release" },
  { id: "beneficiaries", q: "I checked the beneficiaries on my retirement accounts and life insurance in the last 2 years.", weight: 10, gap: "Beneficiary designations not checked recently, and they override a will.", link: "/guides/beneficiary-designations" },
  { id: "minorsMoney", q: "Money left to children or young adults would be held in a trust, not handed over outright.", weight: 7, gap: "Children could receive inheritance outright at 18.", link: "/guides/leaving-money-to-minors" },
  { id: "funded", q: "If I have a trust, my home and accounts are titled in it (check if no trust).", weight: 8, gap: "An unfunded trust may not avoid probate.", link: "/guides/funding-your-trust" },
  { id: "inventory", q: "Someone I trust knows where my documents and accounts are.", weight: 6, gap: "No one knows where your documents and accounts are.", link: "/checklists/asset-and-account-inventory" },
  { id: "digital", q: "I have a plan for passwords and digital accounts.", weight: 4, gap: "No plan for digital accounts and passwords.", link: "/guides/digital-assets-estate-planning" },
  { id: "talked", q: "My executor and guardians know they have been chosen.", weight: 6, gap: "The people you named may not know or agree.", link: "/guides/choosing-an-executor" },
];

export function readinessScore(answers: Record<string, boolean>) {
  const total = READINESS_QUESTIONS.reduce((s, q) => s + q.weight, 0);
  const got = READINESS_QUESTIONS.reduce((s, q) => s + (answers[q.id] ? q.weight : 0), 0);
  const score = Math.round((got / total) * 100);
  const gaps = READINESS_QUESTIONS.filter((q) => !answers[q.id]).sort((a, b) => b.weight - a.weight);
  const band = score >= 85 ? "Well protected" : score >= 60 ? "Partly protected" : score >= 30 ? "Major gaps" : "Mostly unprotected";
  return { score, gaps, band };
}

export default function Readiness() {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [shown, setShown] = useState(false);
  const r = readinessScore(answers);
  return (
    <>
      <div className="tool">
        {READINESS_QUESTIONS.map((q) => (
          <label className="check" key={q.id}>
            <input type="checkbox" checked={!!answers[q.id]} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.checked })} />
            <span>{q.q}</span>
          </label>
        ))}
        <button className="button" type="button" onClick={() => { setShown(true); track("assessment_complete", { score: r.score }); }}>See my score</button>
        {shown && (
          <div className="result" aria-live="polite">
            <p className="big">{r.score} / 100 · {r.band}</p>
            <div className="bar" aria-hidden="true"><span style={{ width: `${r.score}%` }} /></div>
            {r.gaps.length > 0 ? (
              <>
                <p><strong>Your top gaps</strong></p>
                <ol>{r.gaps.slice(0, 3).map((g) => <li key={g.id}>{g.gap} <Link href={g.link}>Learn more</Link></li>)}</ol>
                {r.gaps.length > 3 && <p className="notice">Plus {r.gaps.length - 3} more in your full report.</p>}
              </>
            ) : (
              <p>No gaps on this list. A review every few years keeps it that way.</p>
            )}
          </div>
        )}
      </div>
      {shown && (
        <EmailCapture
          kind="report"
          interest="tool:plan-readiness-assessment"
          title="Email me my full report"
          body="Every gap, in order of importance, with what families usually do about each one."
          cta="Send my report"
          askPhone
          details={{ score: r.score, gaps: r.gaps.map((g) => g.id).join(",") }}
        />
      )}
    </>
  );
}
