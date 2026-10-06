"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { smsConsentText } from "@/lib/consent";

type Kind = "magnet" | "course" | "newsletter" | "callback" | "question" | "report";

/** Pushes a non-identifying analytics event (GA4 / GTM dataLayer). Never send names, emails or answers. */
export function track(event: string, props: Record<string, string | number> = {}) {
  try {
    const w = window as unknown as { dataLayer?: object[] };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event, ...props });
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

async function send(payload: Record<string, unknown>) {
  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, pageUrl: window.location.href }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong. Please try again.");
}

export function EmailCapture({
  kind,
  interest,
  title,
  body,
  cta = "Send it to me",
  success = "Done. Check your inbox in a few minutes.",
  askPhone = false,
  details,
}: {
  kind: Kind;
  interest: string;
  title: string;
  body?: string;
  cta?: string;
  success?: string;
  askPhone?: boolean;
  details?: Record<string, string | number | boolean>;
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
      track("lead_capture", { kind, interest });
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
        <p>Want to talk it through? <Link href="/plan-finder">Book a consult</Link> in about two minutes.</p>
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
    </form>
  );
}

export function CallbackForm({ interest = "callback" }: { interest?: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
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
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="result" role="status">Thanks. Our intake team will call you at the time you picked.</p>;
  return (
    <form className="tool" onSubmit={submit}>
      <div className="row">
        <label className="field">First name<input name="firstName" required autoComplete="given-name" /></label>
        <label className="field">Mobile phone<input name="phone" type="tel" required autoComplete="tel" /></label>
        <label className="field">Email<input name="email" type="email" required autoComplete="email" /></label>
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
        <span>{smsConsentText()}</span>
      </label>
      <div className="hp" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button" type="submit" disabled={busy}>{busy ? "Sending…" : "Request a call back"}</button>
    </form>
  );
}

/** Bottom bar on phones: call, text, book. Hidden on wide screens and in print. */
export function StickyContactBar({ phone, textNumber }: { phone: string; textNumber?: string | null }) {
  const digits = phone.replace(/\D/g, "");
  return (
    <div className="sticky-bar no-print">
      <a href={`tel:${digits}`} onClick={() => track("click_to_call")}>Call</a>
      {textNumber && <a href={`sms:${textNumber.replace(/\D/g, "")}`} onClick={() => track("click_to_text")}>Text</a>}
      <Link href="/plan-finder" onClick={() => track("cta_book", { from: "sticky" })}>Book a consult</Link>
    </div>
  );
}

/**
 * Shown once per visit when a desktop visitor moves to leave the page.
 * An honest offer of a free resource, no countdowns or fake scarcity.
 */
export function ExitIntent() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let shown = false;
    try {
      shown = sessionStorage.getItem("efp-exit") === "1";
    } catch {}
    if (shown || window.matchMedia("(max-width: 800px)").matches) return;
    const armAt = Date.now() + 15000;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY > 0 || Date.now() < armAt || window.location.pathname.startsWith("/plan-finder")) return;
      setOpen(true);
      track("exit_intent_shown");
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
        <h2 id="exit-title" style={{ marginTop: 0 }}>Before you go: the free estate planning starter kit</h2>
        <p>Our 12 printable checklists in one email: what to gather, who to name, and what to do after a death.</p>
        <EmailCapture kind="magnet" interest="starter-kit" title="Email me the starter kit" cta="Send the kit" />
      </div>
    </div>
  );
}
