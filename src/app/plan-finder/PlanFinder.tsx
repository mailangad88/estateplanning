"use client";

import { useEffect, useState } from "react";
import { noRelationshipText, recordingNoticeText, smsConsentText } from "@/lib/consent";
import { QUESTIONS, type EducationTopic, type QuizAnswers } from "@/lib/quiz";
import { US_STATES } from "@/config/firm";

type Answers = Partial<QuizAnswers>;

const SOURCE_KEYS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_term", "utmTerm"],
  ["utm_content", "utmContent"],
  ["gclid", "gclid"],
  ["fbclid", "fbclid"],
] as const;

export default function PlanFinder() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [source, setSource] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ served: boolean; topics: EducationTopic[] } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s: Record<string, string> = { landingPage: window.location.href };
    if (document.referrer) s.referrer = document.referrer;
    for (const [param, key] of SOURCE_KEYS) {
      const v = params.get(param);
      if (v) s[key] = v;
    }
    setSource(s);
  }, []);

  const total = QUESTIONS.length + 1;
  const question = QUESTIONS[step];

  function choose(id: keyof QuizAnswers, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setStep((s) => s + 1);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          phone: form.get("phone"),
          state: form.get("state"),
          county: form.get("county") || undefined,
          preferredContact: form.get("preferredContact"),
          goals: form.get("goals") || undefined,
          answers,
          smsConsent: form.get("smsConsent") === "on",
          acknowledgedNoRelationship: form.get("ack") === "on",
          source,
          website: form.get("website") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.error ?? "Something went wrong. Please call us.");
        return;
      }
      setResult({ served: data.served, topics: data.topics });
    } catch {
      setFormError("Something went wrong. Please call us.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section aria-live="polite">
        <h1>Thank you. Here is what to expect.</h1>
        {result.served ? (
          <p className="lead">A member of our intake team will reach out shortly to set up your consult.</p>
        ) : (
          <p className="lead">
            We are not able to help in your state yet. Your state bar&apos;s lawyer referral service can connect you
            with a licensed estate planning attorney near you.
          </p>
        )}
        <h2>Topics people in a similar situation often discuss with an attorney</h2>
        {result.topics.map((t) => (
          <div className="card" key={t.title} style={{ marginBottom: 12 }}>
            <strong>{t.title}</strong>
            <p style={{ margin: "4px 0 0" }}>{t.body}</p>
          </div>
        ))}
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
        <form onSubmit={submit} noValidate>
          <fieldset>
            <legend>Where should we send your results?</legend>
            <label className="field">First name<input name="firstName" autoComplete="given-name" required /></label>
            {errors.firstName && <p className="error">{errors.firstName}</p>}
            <label className="field">Last name<input name="lastName" autoComplete="family-name" required /></label>
            {errors.lastName && <p className="error">{errors.lastName}</p>}
            <label className="field">Email<input name="email" type="email" autoComplete="email" required /></label>
            {errors.email && <p className="error">{errors.email}</p>}
            <label className="field">Mobile phone<input name="phone" type="tel" autoComplete="tel" required /></label>
            {errors.phone && <p className="error">{errors.phone}</p>}
            <label className="field">
              State where you live
              <select name="state" required defaultValue="">
                <option value="" disabled>Choose a state</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            {errors.state && <p className="error">{errors.state}</p>}
            <label className="field">County (optional)<input name="county" /></label>
            <label className="field">
              Best way to reach you
              <select name="preferredContact" defaultValue="phone">
                <option value="phone">Phone call</option>
                <option value="text">Text message</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label className="field">
              Anything you want the attorney to know? (optional)
              <textarea name="goals" rows={3} />
            </label>
            <div className="hp" aria-hidden="true">
              <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <label className="check">
              <input type="checkbox" name="smsConsent" />
              <span>{smsConsentText()} See our <a href="/legal/sms-terms">text message terms</a> and <a href="/legal/privacy">privacy policy</a>.</span>
            </label>
            <label className="check">
              <input type="checkbox" name="ack" required />
              <span>{noRelationshipText()}</span>
            </label>
            {errors.acknowledgedNoRelationship && <p className="error">{errors.acknowledgedNoRelationship}</p>}
            <p className="notice">{recordingNoticeText()}</p>
            {formError && <p className="error" role="alert">{formError}</p>}
            <div className="nav">
              <button type="button" className="button secondary" onClick={() => setStep(step - 1)}>Back</button>
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Sending…" : "See my results"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </>
  );
}
