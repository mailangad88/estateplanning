"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, CircleCheck, RotateCcw } from "lucide-react";
import type { DecisionGuide } from "@/config/decisions/types";
import { scoreDecision, type DecisionAnswers, type DecisionResult } from "@/lib/decision";
import { track } from "@/components/capture";
import { iconFor } from "./icons";

/**
 * One question at a time, big tap targets, then a ranked result with the reasons behind it.
 * Answers stay in the browser: nothing is sent anywhere, and analytics only sees the guide and the
 * top option's id.
 */
export function DecisionPicker({ guide, anchorBase = "" }: { guide: DecisionGuide; anchorBase?: string }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<DecisionAnswers>({});
  const [result, setResult] = useState<DecisionResult | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const total = guide.questions.length;
  const q = guide.questions[step];
  const picked = answers[q?.id] ?? [];

  useEffect(() => {
    // Keep the question in view on phones after each step, without stealing focus on first render.
    if (step > 0 || result) panel.current?.focus({ preventScroll: false });
  }, [step, result]);

  function finish(next: DecisionAnswers) {
    const r = scoreDecision(guide, next);
    setResult(r);
    track("decision_picker_complete", { guide: guide.slug, result: r.top.option.id });
  }

  function choose(id: string) {
    if (q.multi) {
      setAnswers((a) => {
        const cur = a[q.id] ?? [];
        return { ...a, [q.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
      });
      return;
    }
    const next = { ...answers, [q.id]: [id] };
    setAnswers(next);
    if (step + 1 < total) setStep(step + 1);
    else finish(next);
  }

  function nextStep() {
    if (step + 1 < total) setStep(step + 1);
    else finish(answers);
  }

  function restart() {
    setAnswers({});
    setResult(null);
    setStep(0);
  }

  if (result) {
    const Top = iconFor(result.top.option.icon);
    const bars = result.ranked.filter((r) => r.score > 0).slice(0, 6);
    return (
      <div className="dg-picker dg-picker--result" ref={panel} tabIndex={-1} aria-live="polite">
        <p className="kicker">Your best fit</p>
        <div className="dg-result">
          <div className="dg-result__main">
            <span className={`dg-icon dg-icon--lg dg-tone--${toneOf(guide, result.top.option.family)}`}>
              <Top size={34} aria-hidden="true" />
            </span>
            <div>
              <h3>{result.top.option.name}</h3>
              <p>{result.top.option.what}</p>
            </div>
          </div>
          {result.top.reasons.length > 0 && (
            <>
              <p className="dg-result__why">Why it fits your answers</p>
              <ul className="dg-ticks">
                {result.top.reasons.map((r) => (
                  <li key={r}>
                    <CircleCheck size={18} aria-hidden="true" />
                    {r}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="dg-result__links">
            <a href={`${anchorBase}#opt-${result.top.option.id}`} className="arrow-link">
              See how it compares <ArrowRight size={16} aria-hidden="true" />
            </a>
            {result.top.option.learn && (
              <Link href={result.top.option.learn.href} className="arrow-link">
                {result.top.option.learn.label} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </p>
        </div>

        {result.also.length > 0 && (
          <div className="dg-also">
            <p className="dg-result__why">Also worth asking about</p>
            <ul>
              {result.also.map((a) => {
                const Icon = iconFor(a.option.icon);
                return (
                  <li key={a.option.id}>
                    <a href={`${anchorBase}#opt-${a.option.id}`} className={`dg-chip dg-tone--${toneOf(guide, a.option.family)}`}>
                      <Icon size={18} aria-hidden="true" />
                      <span>
                        <strong>{a.option.name}</strong>
                        {a.reasons[0] && <span>{a.reasons[0]}</span>}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {bars.length > 1 && (
          <figure className="dg-bars">
            <figcaption>How each option matched your answers</figcaption>
            <ol>
              {bars.map((b) => (
                <li key={b.option.id}>
                  <span className="dg-bars__label">{b.option.short ?? b.option.name}</span>
                  <span className="dg-bars__track">
                    <span className={`dg-bars__fill dg-tone--${toneOf(guide, b.option.family)}`} style={{ width: `${Math.max(b.pct, 4)}%` }} />
                  </span>
                  <span className="dg-bars__pct">{b.pct}%</span>
                </li>
              ))}
            </ol>
          </figure>
        )}

        {guide.resultNote && <p className="dg-note">{guide.resultNote}</p>}
        <div className="cta-row">
          <Link className="button" href="/plan-finder">Confirm it with an attorney</Link>
          <button type="button" className="button secondary" onClick={restart}>
            <RotateCcw size={16} aria-hidden="true" /> Start over
          </button>
        </div>
        <p className="notice">General information based on your answers, not legal advice. Your state&apos;s law and your full situation decide what fits.</p>
      </div>
    );
  }

  return (
    <div className="dg-picker" ref={panel} tabIndex={-1}>
      <div className="dg-progress" aria-hidden="true">
        {guide.questions.map((x, i) => (
          <span key={x.id} className={i < step ? "is-done" : i === step ? "is-now" : ""} />
        ))}
      </div>
      <p className="dg-count">
        Question {step + 1} of {total}
      </p>
      <fieldset className="dg-q">
        <legend>
          <h3>{q.prompt}</h3>
          {q.help && <span className="dg-q__help">{q.help}</span>}
        </legend>
        <div className="dg-choices">
          {q.choices.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button
                type="button"
                key={c.id}
                className={`dg-choice${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => choose(c.id)}
              >
                <span className={`dg-choice__box${q.multi ? " is-multi" : ""}`} aria-hidden="true">
                  {on && <CircleCheck size={18} />}
                </span>
                <span>
                  {c.label}
                  {c.detail && <span className="dg-choice__detail">{c.detail}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="dg-nav">
        {step > 0 ? (
          <button type="button" className="dg-back" onClick={() => setStep(step - 1)}>
            <ChevronLeft size={18} aria-hidden="true" /> Back
          </button>
        ) : (
          <span />
        )}
        {q.multi && (
          <button type="button" className="button" disabled={picked.length === 0} onClick={nextStep}>
            {step + 1 < total ? "Next" : "See my result"}
          </button>
        )}
      </div>
    </div>
  );
}

function toneOf(guide: DecisionGuide, family: string) {
  return guide.families.find((f) => f.id === family)?.tone ?? "accent";
}
