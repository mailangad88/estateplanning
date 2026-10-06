"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/components/capture";
import { assignedVariants, useVariant } from "@/lib/experiments";

const PROFILE_KEY = "efp-profile";
const UNLOCKED_KEY = "efp-unlocked";

interface Profile {
  firstName?: string;
  email?: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode: the form still works, it just won't remember
  }
}

/** Experiment variants as flat "exp_<name>" fields for the CRM and dataLayer. */
function prefixed(v: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(v).map(([k, val]) => [`exp_${k}`, val]));
}

export interface MagnetSummary {
  slug: string;
  lang?: string;
  title: string;
  format: string;
  formatLabel: string;
  tag: string;
  sequence: "B" | "G";
}

/**
 * Email-only opt-in for a free resource. No phone field, so no TCPA exposure at opt-in;
 * phone and SMS consent are asked only on consult and call-back forms. Returning visitors
 * see their saved name and email, and resources they already unlocked open straight away.
 */
const ES_FORMATS: Record<string, string> = {
  checklist: "lista", worksheet: "hoja de trabajo", planner: "planificador", guide: "guía", template: "plantilla",
  kit: "kit", workbook: "cuaderno", "email-course": "curso por email",
};

export default function MagnetOptIn({ magnet, compact = false, heading }: { magnet: MagnetSummary; compact?: boolean; heading?: string }) {
  const [profile, setProfile] = useState<Profile>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCourse = magnet.format === "email-course";
  const ctaVariant = useVariant("magnet_cta");
  const fieldsVariant = useVariant("magnet_fields");
  const askName = fieldsVariant === "name_email";
  const viewHref = `/free/${magnet.slug}/view`;

  useEffect(() => {
    setProfile(read<Profile>(PROFILE_KEY, {}));
    if (read<string[]>(UNLOCKED_KEY, []).includes(magnet.slug)) setDone(true);
  }, [magnet.slug]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const firstName = String(f.get("firstName") ?? "").trim() || undefined;
    const email = String(f.get("email") ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: isCourse ? "course" : "magnet",
          interest: `magnet:${magnet.slug}`,
          email,
          firstName,
          details: { tag: magnet.tag, sequence: magnet.sequence, format: magnet.format, lang: magnet.lang ?? "en", ...prefixed(assignedVariants()) },
          pageUrl: window.location.href,
          website: String(f.get("website") ?? "") || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
      if (!res.ok) throw new Error(data.fields?.email ?? data.error ?? "Something went wrong. Please try again.");
      write(PROFILE_KEY, { ...read<Profile>(PROFILE_KEY, {}), firstName, email });
      write(UNLOCKED_KEY, [...new Set([...read<string[]>(UNLOCKED_KEY, []), magnet.slug])]);
      track("lead_capture", { kind: isCourse ? "course" : "magnet", interest: magnet.slug, format: magnet.format, ...prefixed(assignedVariants()) });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (magnet.lang === "es") {
    const kind = ES_FORMATS[magnet.format] ?? "recurso";
    if (done) {
      return (
        <div className="cta optin" role="status" lang="es">
          <strong>Su {kind} está lista.</strong>
          <p>También le enviaremos un enlace por email para que la encuentre después.</p>
          <Link className="button" href={viewHref}>Abrir</Link>
        </div>
      );
    }
    return (
      <form className="cta optin no-print" onSubmit={submit} lang="es">
        <strong>{heading ?? `Reciba gratis: ${magnet.title}`}</strong>
        <p>Ábrala ahora mismo y le enviaremos una copia por email.</p>
        <div className="optin__fields">
          <label className="field">Nombre<input name="firstName" autoComplete="given-name" defaultValue={profile.firstName} key={`f${profile.firstName}`} /></label>
          <label className="field">Email<input name="email" type="email" inputMode="email" required autoComplete="email" defaultValue={profile.email} key={`e${profile.email}`} /></label>
        </div>
        <div className="hp" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button" type="submit" disabled={busy}>{busy ? "Enviando…" : "Acceso inmediato"}</button>
        <p className="notice">
          Le enviaremos este recurso y consejos relacionados de vez en cuando. Puede darse de baja cuando quiera. Nunca
          vendemos su información. Solicitarlo no crea una relación abogado-cliente. <Link href="/legal/privacy">Privacidad</Link>
        </p>
      </form>
    );
  }

  if (done) {
    return (
      <div className="cta optin" role="status">
        <strong>{isCourse ? "You're enrolled." : `Your ${magnet.formatLabel.toLowerCase()} is ready.`}</strong>
        <p>
          {isCourse
            ? "Day 1 is on its way to your inbox. You can also read every lesson now."
            : "We will also email you a link so you can find it later."}
        </p>
        <Link className="button" href={viewHref} onClick={() => track("magnet_open", { interest: magnet.slug })}>
          {isCourse ? "Read the lessons" : `Open the ${magnet.formatLabel.toLowerCase()}`}
        </Link>
        {magnet.sequence === "B" && (
          <p className="notice" style={{ marginTop: 12 }}>
            Want help putting it into practice? <Link href="/plan-finder">Book a consult</Link>.
          </p>
        )}
      </div>
    );
  }

  return (
    <form className={`cta optin no-print${compact ? " optin--compact" : ""}`} onSubmit={submit}>
      <strong>{heading ?? (isCourse ? "Start the free course" : `Get the free ${magnet.formatLabel.toLowerCase()}`)}</strong>
      {!compact && <p>{isCourse ? "One short email a day for five days." : "Open it right away, and we'll email you a copy."}</p>}
      <div className="optin__fields">
        {askName && (
          <label className="field">
            First name
            <input name="firstName" autoComplete="given-name" defaultValue={profile.firstName} key={`f${profile.firstName}`} />
          </label>
        )}
        <label className="field">
          Email
          <input name="email" type="email" inputMode="email" required autoComplete="email" defaultValue={profile.email} key={`e${profile.email}`} />
        </label>
      </div>
      <div className="hp" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button" type="submit" disabled={busy}>
        {busy
          ? "Sending…"
          : isCourse
            ? "Send me day 1"
            : ctaVariant === "specific"
              ? `Send me the ${magnet.formatLabel.toLowerCase()}`
              : "Get instant access"}
      </button>
      <p className="notice">
        {magnet.sequence === "G"
          ? "We'll email you this resource and a few short, practical follow-ups. No sales emails. Unsubscribe any time."
          : "We'll email you this resource and occasional related tips. Unsubscribe any time. We never sell your information."}{" "}
        Requesting it does not create an attorney-client relationship. <Link href="/legal/privacy">Privacy</Link>
      </p>
    </form>
  );
}
