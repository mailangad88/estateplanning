"use client";

import { useEffect, useState } from "react";
import { US_STATES } from "@/config/firm";
import { toolConfig } from "@/config/tools";
import { HEARD_FROM_OPTIONS } from "@/lib/heardFrom";
import { noRelationshipText, recordingNoticeText, smsConsentText } from "@/lib/consent";
import type { CaptureTool } from "@/lib/lead";
import type { EducationTopic, QuizAnswers } from "@/lib/quiz";
import { forgetVisitor, loadVisitor, rememberSubmission, sessionSource, visitorIdForSubmission, type KnownContact } from "@/lib/visitor";

export interface LeadResponse {
  served: boolean;
  topics: EducationTopic[];
  guideUrl?: string;
}

interface Props {
  tool: CaptureTool;
  resource?: string;
  result?: Record<string, string | number | boolean>;
  answers?: Partial<QuizAnswers>;
  legend: string;
  /** One line under the legend explaining what the visitor gets for their details */
  why?: string;
  submitLabel: string;
  askLastName?: boolean;
  askCounty?: boolean;
  askPreferredContact?: boolean;
  askGoals?: boolean;
  goalsLabel?: string;
  /** Optional "How did you hear about us?" select (consult forms) */
  askHeardFrom?: boolean;
  /** State the visitor already chose earlier in the flow; prefills the state field */
  defaultState?: string;
  onBack?: () => void;
  onSuccess: (data: LeadResponse) => void;
}

/**
 * Shared contact capture used by every tool. Consent boxes are never pre-checked, SMS
 * consent is optional and separate, and details a returning visitor already gave on
 * this device are prefilled so they only fill in what is missing.
 */
export default function LeadForm(props: Props) {
  const [known, setKnown] = useState<KnownContact>({});
  const [priorTools, setPriorTools] = useState<CaptureTool[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const v = loadVisitor();
    if (v) {
      setKnown(v.contact);
      setPriorTools(v.tools);
    }
  }, []);

  const returning = Boolean(known.email && known.firstName);
  const phoneOptional = toolConfig.phoneOptionalFor.includes(props.tool);

  function forget() {
    forgetVisitor();
    setKnown({});
    setPriorTools([]);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : undefined;
    };
    const contact: KnownContact = {
      firstName: get("firstName"),
      lastName: get("lastName") ?? known.lastName,
      email: get("email"),
      phone: get("phone"),
      state: get("state"),
    };
    const visitorId = visitorIdForSubmission();
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...contact,
          county: get("county"),
          preferredContact: get("preferredContact") ?? "phone",
          goals: get("goals"),
          answers: props.answers ?? {},
          capture: { tool: props.tool, resource: props.resource, result: props.result },
          visitorId,
          priorTools,
          smsConsent: form.get("smsConsent") === "on",
          acknowledgedNoRelationship: form.get("ack") === "on",
          source: { ...sessionSource(), heardFrom: get("heardFrom") },
          website: get("website"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.error ?? "Something went wrong. Please call us.");
        return;
      }
      rememberSubmission(visitorId, contact, props.tool);
      props.onSuccess(data as LeadResponse);
    } catch {
      setFormError("Something went wrong. Please call us.");
    } finally {
      setSubmitting(false);
    }
  }

  const err = (k: string) => errors[k] && <p className="error">{errors[k]}</p>;

  return (
    <form onSubmit={submit} noValidate className="lead-form">
      <fieldset>
        <legend>{props.legend}</legend>
        {props.why && <p className="notice">{props.why}</p>}
        {returning && (
          <p className="notice">
            Welcome back, {known.firstName}. We filled in the details you gave us before.{" "}
            <button type="button" className="linklike" onClick={forget}>Not you? Clear them</button>
          </p>
        )}
        <div className="field-row">
          <label className="field">
            First name
            <input name="firstName" autoComplete="given-name" required defaultValue={known.firstName} key={`f${known.firstName}`} />
          </label>
          {props.askLastName && (
            <label className="field">
              Last name
              <input name="lastName" autoComplete="family-name" defaultValue={known.lastName} key={`l${known.lastName}`} />
            </label>
          )}
        </div>
        {err("firstName")}
        <label className="field">
          Email
          <input name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={known.email} key={`e${known.email}`} />
        </label>
        {err("email")}
        <label className="field">
          Mobile phone{phoneOptional && " (optional)"}
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required={!phoneOptional} defaultValue={known.phone} key={`p${known.phone}`} />
        </label>
        {err("phone")}
        <label className="field">
          State where you live
          <select name="state" required defaultValue={props.defaultState ?? known.state ?? ""} key={`s${props.defaultState ?? known.state}`}>
            <option value="" disabled>Choose a state</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {err("state")}
        {props.askCounty && <label className="field">County (optional)<input name="county" /></label>}
        {props.askPreferredContact && (
          <label className="field">
            Best way to reach you
            <select name="preferredContact" defaultValue="phone">
              <option value="phone">Phone call</option>
              <option value="text">Text message</option>
              <option value="email">Email</option>
            </select>
          </label>
        )}
        {props.askGoals && (
          <label className="field">
            {props.goalsLabel ?? "Anything you want the attorney to know? (optional)"}
            <textarea name="goals" rows={3} />
          </label>
        )}
        {props.askHeardFrom && (
          <label className="field">
            How did you hear about us? (optional)
            <select name="heardFrom" defaultValue="">
              <option value="">Choose one</option>
              {HEARD_FROM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <div className="hp" aria-hidden="true">
          <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <label className="check">
          <input type="checkbox" name="smsConsent" />
          <span>
            Optional: {smsConsentText()} See our <a href="/legal/sms-terms">text message terms</a> and{" "}
            <a href="/legal/privacy">privacy policy</a>.
          </span>
        </label>
        <label className="check">
          <input type="checkbox" name="ack" required />
          <span>{noRelationshipText()}</span>
        </label>
        {err("acknowledgedNoRelationship")}
        <p className="notice">
          {recordingNoticeText()} We remember the details you enter on this device so you don&apos;t have to type them again.
        </p>
        {formError && <p className="error" role="alert">{formError}</p>}
        <div className="nav">
          {props.onBack ? (
            <button type="button" className="button secondary" onClick={props.onBack}>Back</button>
          ) : <span />}
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? "Sending…" : props.submitLabel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
