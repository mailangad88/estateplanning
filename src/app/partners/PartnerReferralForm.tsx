"use client";

import { useState } from "react";

/** Referral form on a partner's page. The send button stays off until the partner confirms the person agreed. */
export default function PartnerReferralForm({ slug, consentText, partnerOrg }: { slug: string; consentText: string; partnerOrg: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "").trim();
    try {
      const res = await fetch(`/api/partners/${encodeURIComponent(slug)}/referral`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: get("firstName"),
          lastName: get("lastName"),
          email: get("email"),
          phone: get("phone"),
          state: get("state"),
          clientConsent: consent,
          website: get("website"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.error ?? "Something went wrong. Please call us.");
        return;
      }
      setDone(true);
    } catch {
      setFormError("Something went wrong. Please call us.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section aria-live="polite" className="card">
        <h2 style={{ marginTop: 0 }}>Thank you, {partnerOrg}.</h2>
        <p>We have the referral. We will contact the person you named. We will not tell you whether they get in touch or hire us unless they sign a release allowing it.</p>
      </section>
    );
  }

  const err = (k: string) => errors[k] && <p className="error">{errors[k]}</p>;
  return (
    <form onSubmit={submit} noValidate className="lead-form">
      <fieldset>
        <legend>Refer someone to us</legend>
        <div className="field-row">
          <label className="field">Their first name<input name="firstName" autoComplete="off" required />{err("firstName")}</label>
          <label className="field">Last name<input name="lastName" autoComplete="off" />{err("lastName")}</label>
        </div>
        <label className="field">Their email<input name="email" type="email" autoComplete="off" required />{err("email")}</label>
        <label className="field">Their phone (optional)<input name="phone" type="tel" autoComplete="off" />{err("phone")}</label>
        <label className="field">Their state
          <input name="state" maxLength={2} placeholder="TX" autoComplete="off" required />{err("state")}
        </label>
        <div className="hp" aria-hidden="true">
          <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <label className="check">
          <input type="checkbox" name="clientConsent" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
          <span>{consentText}</span>
        </label>
        {err("clientConsent")}
        <p className="notice">Please send only name and contact details. Do not include anything else about the person&apos;s situation.</p>
        {formError && <p className="error" role="alert">{formError}</p>}
        <button type="submit" className="button" disabled={submitting || !consent}>{submitting ? "Sending…" : "Send referral"}</button>
      </fieldset>
    </form>
  );
}
