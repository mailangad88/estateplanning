"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/components/capture";
import type { MagnetSummary } from "@/components/MagnetOptIn";
import { assignedVariants, useVariant } from "@/lib/experiments";

interface Option {
  label: string;
  points: number;
}
interface Question {
  id: string;
  prompt: string;
  options: Option[];
  explanation: string;
}
interface Band {
  min: number;
  max: number;
  label: string;
  summary: string;
}

const PROFILE_KEY = "efp-profile";
const UNLOCKED_KEY = "efp-unlocked";

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * One question per screen, then the score. The full answer review is unlocked with an email,
 * which also sends the matching free resource. Which comes first, the score or the email
 * request, is the quiz_gate experiment; the email-first variant always offers a skip link.
 */
export default function QuizRunner({
  quiz,
  magnet,
}: {
  quiz: { slug: string; kind: "knowledge" | "assessment"; questions: Question[]; bands: Band[]; max: number };
  magnet: MagnetSummary | null;
}) {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [skippedGate, setSkippedGate] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gate = useVariant("quiz_gate");

  useEffect(() => {
    const p = readJson<{ email?: string; firstName?: string }>(PROFILE_KEY, {});
    setEmail(p.email ?? "");
    setFirstName(p.firstName ?? "");
    track("tool_view", { tool_id: `quiz:${quiz.slug}` });
  }, [quiz.slug]);

  const total = quiz.questions.length;
  const done = step >= total;
  const score = picks.reduce((s, idx, i) => s + (quiz.questions[i]?.options[idx]?.points ?? 0), 0);
  const band = quiz.bands.find((b) => score >= b.min && score <= b.max);

  function choose(idx: number) {
    const next = [...picks.slice(0, step), idx];
    setPicks(next);
    if (step === 0) track("tool_start", { tool_id: `quiz:${quiz.slug}` });
    if (step + 1 >= total) track("tool_complete", { tool_id: `quiz:${quiz.slug}`, band: quiz.bands.findIndex((b) => b.label === bandOf(next)?.label) });
    setStep(step + 1);
  }

  function bandOf(p: number[]) {
    const s = p.reduce((sum, idx, i) => sum + (quiz.questions[i]?.options[idx]?.points ?? 0), 0);
    return quiz.bands.find((b) => s >= b.min && s <= b.max);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const variants = Object.fromEntries(Object.entries(assignedVariants()).map(([k, v]) => [`exp_${k}`, v]));
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "report",
          interest: `quiz:${quiz.slug}`,
          email,
          firstName: firstName || undefined,
          details: {
            score,
            max: quiz.max,
            band: band?.label ?? "",
            ...(magnet ? { magnet: magnet.slug, tag: magnet.tag, sequence: magnet.sequence } : {}),
            ...variants,
          },
          pageUrl: window.location.href,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
      if (!res.ok) throw new Error(data.fields?.email ?? data.error ?? "Something went wrong. Please try again.");
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...readJson(PROFILE_KEY, {}), email, firstName: firstName || undefined }));
        if (magnet) localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...new Set([...readJson<string[]>(UNLOCKED_KEY, []), magnet.slug])]));
      } catch {
        // storage blocked: fine
      }
      track("lead_capture", { kind: "report", interest: `quiz:${quiz.slug}`, ...variants });
      setUnlocked(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!done) {
    const q = quiz.questions[step];
    return (
      <div className="tool quiz">
        <div className="progress" aria-hidden="true"><span style={{ width: `${(step / total) * 100}%` }} /></div>
        <p className="meta">Question {step + 1} of {total}</p>
        <fieldset className="question">
          <legend>{q.prompt}</legend>
          {q.options.map((o, i) => (
            <button type="button" key={o.label} className={`quiz-option${picks[step] === i ? " is-picked" : ""}`} onClick={() => choose(i)}>
              {o.label}
            </button>
          ))}
        </fieldset>
        {step > 0 && <button type="button" className="linklike" onClick={() => setStep(step - 1)}>Back</button>}
      </div>
    );
  }

  const optIn = !unlocked && (
    <form className="cta optin" onSubmit={submit}>
      <strong>{magnet ? `Get your full answer review and the free ${magnet.formatLabel.toLowerCase()}` : "Get your full answer review"}</strong>
      <p>
        {quiz.kind === "knowledge" ? "See the right answer and the reason for every question" : "See what each answer means for your family"}
        {magnet ? `, plus "${magnet.title}".` : "."}
      </p>
      <div className="optin__fields">
        <label className="field">First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" /></label>
        <label className="field">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button" type="submit" disabled={busy}>{busy ? "Sending…" : "Show my answer review"}</button>
      <p className="notice">
        We'll email you a copy and occasional related tips. Unsubscribe any time. <Link href="/legal/privacy">Privacy</Link>
      </p>
    </form>
  );

  if (gate === "email_first" && !unlocked && !skippedGate) {
    return (
      <div className="tool quiz">
        <div className="result" role="status"><strong>Your result is ready.</strong></div>
        {optIn}
        <button type="button" className="linklike" onClick={() => { setSkippedGate(true); track("quiz_gate_skip", { tool_id: `quiz:${quiz.slug}` }); }}>
          Skip, just show my score
        </button>
      </div>
    );
  }

  return (
    <div className="tool quiz">
      <div className="result" role="status">
        <p className="big" style={{ margin: 0 }}>{score} / {quiz.max}</p>
        {band && <><strong>{band.label}</strong><p>{band.summary}</p></>}
      </div>
      {optIn}
      {unlocked && (
        <>
          <h2>Your answer review</h2>
          <ol className="quiz-review">
            {quiz.questions.map((q, i) => {
              const best = Math.max(...q.options.map((o) => o.points));
              const picked = q.options[picks[i]];
              const right = quiz.kind === "knowledge" ? q.options.find((o) => o.points === best) : null;
              return (
                <li key={q.id}>
                  <strong>{q.prompt}</strong>
                  <p className="meta" style={{ margin: "4px 0" }}>
                    Your answer: {picked?.label}
                    {right && (picked?.points === best ? " ✓" : ` · Answer: ${right.label}`)}
                  </p>
                  <p>{q.explanation}</p>
                </li>
              );
            })}
          </ol>
          {magnet && (
            <p>
              <Link className="button" href={`/free/${magnet.slug}/view`}>Open your free {magnet.formatLabel.toLowerCase()}</Link>
            </p>
          )}
          {magnet?.sequence !== "G" && <p>Want to talk through your results? <Link href="/plan-finder">Book a consult</Link>.</p>}
        </>
      )}
      <p>
        <button type="button" className="linklike" onClick={() => { setStep(0); setPicks([]); }}>Take it again</button>
      </p>
    </div>
  );
}
