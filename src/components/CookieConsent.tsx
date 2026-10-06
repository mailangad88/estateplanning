"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONSENT_KEY, makeChoice, parseChoice, toConsentUpdate, type ConsentChoice } from "@/lib/consent-cookies";

type Gtag = (...args: unknown[]) => void;
type ConsentWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag; };

export const OPEN_CONSENT_EVENT = "efp:open-consent";

function apply(choice: ConsentChoice) {
  const w = window as ConsentWindow;
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  w.dataLayer = w.dataLayer || [];
  const gtag: Gtag = w.gtag ?? function () { w.dataLayer!.push(arguments); };
  gtag("consent", "update", toConsentUpdate(choice, gpc));
  w.dataLayer.push({ event: "consent_update" });
}

export function CookieSettingsButton() {
  return (
    <button type="button" className="linklike" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      Cookie settings
    </button>
  );
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);

  useEffect(() => {
    let saved: ConsentChoice | null = null;
    try { saved = parseChoice(localStorage.getItem(CONSENT_KEY)); } catch { /* storage blocked */ }
    if (!saved) setOpen(true);
    const reopen = () => {
      let cur: ConsentChoice | null = null;
      try { cur = parseChoice(localStorage.getItem(CONSENT_KEY)); } catch { /* ignore */ }
      setAnalytics(cur?.analytics ?? false);
      setAds(cur?.ads ?? false);
      setChoosing(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  function save(a: boolean, d: boolean) {
    const choice = makeChoice(a, d);
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(choice)); } catch { /* storage blocked */ }
    apply(choice);
    setOpen(false);
    setChoosing(false);
  }

  if (!open) return null;
  return (
    <div className="cookie-consent no-print" role="dialog" aria-label="Cookie choices">
      <p>
        We use analytics and advertising cookies only if you allow them. See our <Link href="/legal/privacy">privacy policy</Link>.
      </p>
      {choosing && (
        <div>
          <label className="check">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
            <span>Analytics: helps us see which pages are useful.</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} />
            <span>Advertising: lets ad platforms measure and personalise ads.</span>
          </label>
        </div>
      )}
      <div className="cookie-consent-actions">
        <button type="button" className="button" onClick={() => save(true, true)}>Accept all</button>
        <button type="button" className="button" onClick={() => save(false, false)}>Reject all</button>
        {choosing ? (
          <button type="button" className="button" onClick={() => save(analytics, ads)}>Save choices</button>
        ) : (
          <button type="button" className="button" onClick={() => setChoosing(true)}>Choose</button>
        )}
      </div>
    </div>
  );
}
