"use client";

import Link from "next/link";
import { useState } from "react";
import LeadForm from "@/components/LeadForm";
import { READINESS_ITEMS, scoreReadiness, type ReadinessAnswer, type ReadinessResult } from "@/lib/tools/readiness";

const CHOICES: { value: ReadinessAnswer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
];

export default function Readiness() {
  const [answers, setAnswers] = useState<Record<string, ReadinessAnswer>>({});
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const answered = READINESS_ITEMS.filter((i) => answers[i.id]).length;

  if (result) {
    return (
      <>
        <h1>Your readiness score</h1>
        <div className="result" aria-live="polite">
          <div className="big">{result.score} / 100</div>
          <div className="meter" aria-hidden="true"><span style={{ width: `${result.score}%` }} /></div>
          <p><strong>{result.bandLabel}.</strong> {result.gaps.length === 0
            ? "You have the common pieces in place. A periodic review keeps it that way."
            : `We found ${result.gaps.length} ${result.gaps.length === 1 ? "area" : "areas"} that families often address.`}</p>
        </div>

        {unlocked ? (
          <>
            <h2>Your gap report</h2>
            {result.gaps.map((g) => (
              <div className="card" key={g.id} style={{ marginBottom: 12 }}>
                <strong>{g.prompt}</strong>
                <p style={{ margin: "4px 0 0" }}>{g.unsure ? "You weren't sure. " : ""}{g.gap}</p>
              </div>
            ))}
            <p>
              We will email you a copy, and someone from our intake team may reach out to see if you have questions. You can also{" "}
              <Link href="/intake">book a consult</Link> or download the <Link href="/resources/estate-planning-checklist">full checklist</Link>.
            </p>
          </>
        ) : result.gaps.length > 0 ? (
          <LeadForm
            tool="readiness_score"
            result={{ readinessScore: result.score, band: result.band, gaps: result.gaps.map((g) => g.id).join(",") }}
            legend="Get your full gap report"
            why="We'll show what each gap means right here and email you a copy with a printable checklist."
            submitLabel="Show my gap report"
            onBack={() => setResult(null)}
            onSuccess={() => setUnlocked(true)}
          />
        ) : null}
        <p className="notice">This score measures how organized your planning is, not whether your documents are legally valid.</p>
      </>
    );
  }

  return (
    <>
      <h1>How ready is your estate plan?</h1>
      <p className="lead">Ten yes-or-no questions. Your score appears right away.</p>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.round((answered / READINESS_ITEMS.length) * 100)}%` }} />
      </div>
      {READINESS_ITEMS.map((item) => (
        <fieldset className="question" key={item.id}>
          <legend style={{ fontSize: "1rem" }}>{item.prompt}</legend>
          <div className="inline-options">
            {[...CHOICES, ...(item.canSkip ? [{ value: "not_applicable" as const, label: "Doesn't apply" }] : [])].map((c) => (
              <label className="option" key={c.value}>
                <input
                  type="radio"
                  name={item.id}
                  value={c.value}
                  checked={answers[item.id] === c.value}
                  onChange={() => setAnswers((a) => ({ ...a, [item.id]: c.value }))}
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="nav">
        <span className="notice">{answered} of {READINESS_ITEMS.length} answered</span>
        <button
          type="button"
          className="button"
          disabled={answered < READINESS_ITEMS.length}
          onClick={() => setResult(scoreReadiness(answers))}
        >
          See my score
        </button>
      </div>
    </>
  );
}
