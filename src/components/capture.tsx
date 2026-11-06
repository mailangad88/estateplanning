"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { recordingNoticeText, smsConsentText } from "@/lib/consent";
import { filterEvent } from "@/lib/analytics";
import { useTrackingNumber } from "@/components/TrackedPhone";
import FormDisclaimer from "@/components/FormDisclaimer";
import { useVariant } from "@/lib/experiments";
import { bookHref, fromForPath, topicForPath } from "@/lib/book";
import { firm } from "@/config/firm";

type Kind = "magnet" | "course" | "newsletter" | "callback" | "question" | "report";

/**
 * Pushes a non-identifying analytics event (GA4 / GTM dataLayer). Never send names, emails or answers.
 * `filterEvent` strips health and orientation terms and restricts sensitive pages (config/sensitive.ts).
 */
export function track(event: string, props: Record<string, string | number> = {}) {
  try {
    const payload = filterEvent(event, props, window.location.pathname);
    if (!payload) return;
    const w = window as unknown as { dataLayer?: object[] };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push(payload);
  } catch {
    // analytics must never break the page
  }
}

const PROFILE_KEY = "efp-profile";

interface Profile {
  firstName?: string;
  email?: string;
}

function loadProfile(): Profile {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as Profile;
  } catch {
    return {};
  }
}

function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...loadProfile(), ...p }));
  } catch {
    // private mode: ignore
  }
}

/** Error from /api/subscribe; `fields` maps a field name to the server's message so the form can mark it. */
class SendError extends Error {
  constructor(message: string, readonly fields: Record<string, string> = {}) {
    super(message);
  }
}

async function send(payload: Record<string, unknown>) {
  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, pageUrl: window.location.href }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
  if (!res.ok) throw new SendError(data.error ?? "Something went wrong. Please try again.", data.fields ?? {});
}

/** Plain-language messages for the fields the call-back form sends. */
const FIELD_HELP: Record<string, string> = {
  firstName: "Please enter your first name.",
  email: "Please enter an email address like name@example.com.",
  phone: "Please enter a 10-digit US phone number, like 312 555 0100.",
};

export function EmailCapture({
  kind,
  interest,
  title,
  body,
  cta = "Send it to me",
  success = "Done. Check your inbox in a few minutes.",
  askPhone = false,
  details,
  sensitive = false,
}: {
  kind: Kind;
  interest: string;
  title: string;
  body?: string;
  cta?: string;
  success?: string;
  askPhone?: boolean;
  details?: Record<string, string | number | boolean>;
  /** Health, disability or family-structure pages: send no analytics event about this signup. */
  sensitive?: boolean;
}) {
  const [profile, setProfile] = useState<Profile>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setProfile(loadProfile()), []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const firstName = String(f.get("firstName") ?? "") || undefined;
      const email = String(f.get("email") ?? "");
      await send({
        kind,
        interest,
        email,
        firstName,
        phone: String(f.get("phone") ?? "") || undefined,
        smsConsent: f.get("smsConsent") === "on",
        details,
        website: String(f.get("website") ?? "") || undefined,
      });
      saveProfile({ firstName, email });
      if (!sensitive) track("lead_capture", { kind, interest });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="cta" role="status">
        <strong>{success}</strong>
        <p>Want to talk it through? <Link href="/book?from=email-capture">Book a consult</Link> and pick a time.</p>
      </div>
    );
  }

  return (
    <form className="cta no-print" onSubmit={submit}>
      <strong>{title}</strong>
      {body && <p>{body}</p>}
      <div className="row" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label className="field">First name<input name="firstName" autoComplete="given-name" defaultValue={profile.firstName} /></label>
        <label className="field">Email<input name="email" type="email" required autoComplete="email" defaultValue={profile.email} /></label>
        {askPhone && <label className="field">Mobile (optional)<input name="phone" type="tel" autoComplete="tel" /></label>}
      </div>
      {askPhone && (
        <label className="check">
          <input type="checkbox" name="smsConsent" />
          <span>{smsConsentText()}</span>
        </label>
      )}
      <div className="hp" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button" type="submit" disabled={busy}>{busy ? "Sending…" : cta}</button>
      <p className="notice">No spam. Unsubscribe any time. We never sell your information. <Link href="/legal/privacy">Privacy</Link></p>
      <FormDisclaimer />
    </form>
  );
}

export function CallbackForm({ interest = "callback" }: { interest?: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await send({
        kind: "callback",
        interest,
        firstName: String(f.get("firstName") ?? "") || undefined,
        email: String(f.get("email") ?? ""),
        phone: String(f.get("phone") ?? ""),
        message: `Best time: ${String(f.get("bestTime") ?? "")}`,
        smsConsent: f.get("smsConsent") === "on",
        website: String(f.get("website") ?? "") || undefined,
      });
      track("lead_capture", { kind: "callback", interest });
      setDone(true);
    } catch (err) {
      const fields = err instanceof SendError ? err.fields : {};
      const named = Object.fromEntries(Object.keys(fields).filter((k) => k in FIELD_HELP).map((k) => [k, FIELD_HELP[k]]));
      setFieldErrors(named);
      setError(Object.keys(named).length ? "Please fix the field marked above." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const errProps = (name: string) =>
    fieldErrors[name] ? { "aria-invalid": true as const, "aria-describedby": `cb-${name}-error` } : {};
  const errText = (name: string) =>
    fieldErrors[name] ? <span className="error" id={`cb-${name}-error`}>{fieldErrors[name]}</span> : null;

  if (done) {
    return (
      <div className="result" role="status">
        <p><strong>Thanks, your request is in.</strong> Someone from our intake team will call at the time you picked to set up a consult with an Illinois estate planning attorney in our network. There is no obligation.</p>
        {firm.calcomLink && typeof window !== "undefined" && !window.location.pathname.startsWith("/book") && (
          <p>Rather lock in a time now? <Link href={bookHref("callback-thanks", topicForPath(window.location.pathname))}>Pick one on the calendar</Link>.</p>
        )}
      </div>
    );
  }
  return (
    <form className="tool" onSubmit={submit} noValidate>
      <div className="row">
        <label className="field">First name<input name="firstName" required autoComplete="given-name" enterKeyHint="next" {...errProps("firstName")} />{errText("firstName")}</label>
        <label className="field">Email<input name="email" type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" {...errProps("email")} />{errText("email")}</label>
        <label className="field">
          Mobile phone
          <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" enterKeyHint="next" {...errProps("phone")} />
          <span className="field-hint">So we can call you to set up the consult. We call only about your request.</span>
          {errText("phone")}
        </label>
        <label className="field">
          Best time to call
          <select name="bestTime" defaultValue="Morning">
            <option>Morning</option>
            <option>Midday</option>
            <option>Afternoon</option>
            <option>Evening</option>
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" name="smsConsent" />
        <span>Text me too (optional). {smsConsentText()}</span>
      </label>
      <div className="hp" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button" type="submit" disabled={busy}>{busy ? "Sending…" : "Request a call back"}</button>
      <p className="notice">
        Your details stay confidential and go only to the Illinois attorney in our network we match you with. We never sell
        your information. {recordingNoticeText()} <Link href="/legal/privacy">Privacy</Link>
      </p>
      <FormDisclaimer />
    </form>
  );
}

/** Bottom bar on phones: call, text, book. Hidden on wide screens and in print. */
export function StickyContactBar({ phone: fallback, textNumber }: { phone: string; textNumber?: string | null }) {
  const phone = useTrackingNumber(fallback); // dynamic number insertion by first-touch source
  const digits = phone.replace(/\D/g, "");
  return (
    <div className="sticky-bar no-print">
      <a href={`tel:${digits}`} onClick={() => track("click_to_call")}>Call</a>
      {textNumber && <a href={`sms:${textNumber.replace(/\D/g, "")}`} onClick={() => track("click_to_text")}>Text</a>}
      <StickyBook />
    </div>
  );
}

/** Sticky-bar booking link: carries the page as `from` and the page's topic, so phone bookings trace to a page. */
function StickyBook() {
  const p = usePathname() ?? "/";
  const href = bookHref(`sticky-${fromForPath(p)}`.slice(0, 60), topicForPath(p));
  if (p.startsWith("/book")) return null;
  return <Link href={href} onClick={() => track("cta_book", { from: "sticky" })}>Book a consult</Link>;
}

/**
 * Shown once per visit when a desktop visitor moves to leave the page.
 * An honest offer of a free resource, no countdowns or fake scarcity.
 */
export function ExitIntent() {
  const [open, setOpen] = useState(false);
  const offer = useVariant("exit_offer");
  const [kit, setKit] = useState(false);
  const offerRef = useRef<string>(offer);
  offerRef.current = offer;
  useEffect(() => {
    let shown = false;
    try {
      shown = sessionStorage.getItem("efp-exit") === "1";
    } catch {}
    if (shown || window.matchMedia("(max-width: 800px)").matches) return;
    const armAt = Date.now() + 15000;
    const onLeave = (e: MouseEvent) => {
      if (document.documentElement.dataset.sensitive === "1") return;
      if (e.clientY > 0 || Date.now() < armAt || /^\/(plan-finder|book|intake|callback|portal|admin|client)/.test(window.location.pathname)) return;
      setOpen(true);
      track("exit_intent_shown", { offer: offerRef.current });
      try {
        sessionStorage.setItem("efp-exit", "1");
      } catch {}
      document.removeEventListener("mouseout", onLeave);
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, []);

  if (!open) return null;
  return (
    <div className="modal-backdrop no-print" role="dialog" aria-modal="true" aria-labelledby="exit-title" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
        {offer === "book_call" ? (
          <>
            <h2 id="exit-title" style={{ marginTop: 0 }}>Before you go: want to just ask an attorney?</h2>
            <p>
              Pick a time that suits you and we match you with an estate planning attorney in our network. No questionnaire first,
              and you see the flat fee before anything is signed.
            </p>
            <p className="cta-row">
              <Link
                className="button"
                href={bookHref("exit-intent", topicForPath(window.location.pathname))}
                onClick={() => setOpen(false)}
              >
                See open times
              </Link>
              {!kit && (
                <button type="button" className="button secondary" onClick={() => setKit(true)}>
                  Or email me the free starter kit
                </button>
              )}
            </p>
            {kit && <EmailCapture kind="magnet" interest="starter-kit" title="Email me the starter kit" cta="Send the kit" />}
          </>
        ) : (
          <>
            <h2 id="exit-title" style={{ marginTop: 0 }}>Before you go: the free estate planning starter kit</h2>
            <p>Our 12 printable checklists in one email: what to gather, who to name, and what to do after a death.</p>
            <EmailCapture kind="magnet" interest="starter-kit" title="Email me the starter kit" cta="Send the kit" />
          </>
        )}
      </div>
    </div>
  );
}

/** Marks the page as sensitive for the visit: the exit-intent offer stays off. Renders nothing. */
export function SensitiveMarker() {
  useEffect(() => {
    document.documentElement.dataset.sensitive = "1";
    return () => {
      delete document.documentElement.dataset.sensitive;
    };
  }, []);
  return null;
}
