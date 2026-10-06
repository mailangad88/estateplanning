"use client";

import { useId, useState } from "react";
import base from "./FamilyPlanner.module.css";
import styles from "./Account.module.css";

/** POST JSON and read the JSON answer; network failures come back as an error message. */
export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "We could not reach the server. Check your connection and try again." } };
  }
}

export const errorText = (data: Record<string, unknown>, fallback = "Something went wrong. Please try again.") =>
  typeof data.error === "string" ? data.error : fallback;

/** One code box: 6 digits from the app, or (when allowed) a recovery code. */
export function CodeForm({
  label,
  submitLabel,
  busyLabel = "Checking…",
  allowRecovery = false,
  danger = false,
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  busyLabel?: string;
  allowRecovery?: boolean;
  danger?: boolean;
  onSubmit: (code: string) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError(recovery ? "Enter one of your recovery codes." : "Enter the 6-digit code from your app.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await onSubmit(code.trim());
    setBusy(false);
    if (err) {
      setError(err);
      setCode("");
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <label className="field" htmlFor={id}>
        {recovery ? "Recovery code" : label}
        <input
          id={id}
          className={styles.codeInput}
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode={recovery ? "text" : "numeric"}
          pattern={recovery ? undefined : "[0-9 ]*"}
          autoComplete="one-time-code"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={recovery ? 20 : 7}
          placeholder={recovery ? "xxxxx-xxxxx" : "123456"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        {error && <span id={`${id}-err`} className="error" role="alert">{error}</span>}
      </label>
      <div className={base.actions}>
        <button type="submit" className={danger ? base.dangerSolid : "button"} disabled={busy}>{busy ? busyLabel : submitLabel}</button>
        {allowRecovery && (
          <button type="button" className="linklike" onClick={() => { setRecovery(!recovery); setCode(""); setError(null); }}>
            {recovery ? "Use a code from my app instead" : "Use a recovery code instead"}
          </button>
        )}
        {onCancel && <button type="button" className="linklike" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

/** The key and setup link for an authenticator app. */
export function AuthenticatorSetup({ secret, otpauthUrl }: { secret: string; otpauthUrl: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <ol className={styles.steps}>
        <li>
          Open an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator, Apple Passwords or 1Password.
          Any app that makes 6-digit codes works.
        </li>
        <li>
          <strong>On this phone?</strong> <a href={otpauthUrl}>Add it to my authenticator app</a>.{" "}
          <strong>On a computer?</strong> In the app, choose to add an account by entering a setup key, and type this key:
          <span className={styles.keyBox}>
            <code className={styles.key} aria-label={`Setup key ${secret.split("").join(" ")}`}>{secret}</code>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                void navigator.clipboard?.writeText(secret.replace(/\s/g, "")).then(() => setCopied(true), () => undefined);
              }}
            >
              {copied ? "Copied" : "Copy key"}
            </button>
          </span>
          <span className="notice">Name it anything you like, for example &ldquo;Family plan&rdquo;. If the app asks, choose time-based.</span>
        </li>
        <li>Type the 6-digit code the app shows below.</li>
      </ol>
    </>
  );
}

/** Recovery codes, shown once, with ways to keep them. */
export function RecoveryCodes({ codes, onDone, doneLabel }: { codes: string[]; onDone: () => void; doneLabel: string }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `My family plan: recovery codes\nEach code works once. Keep them somewhere safe, away from your phone.\n\n${codes.join("\n")}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "family-plan-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className={base.card} aria-labelledby="fp-codes-h">
      <h2 id="fp-codes-h">Save your recovery codes</h2>
      <p>
        If you lose your phone, each of these codes gets you in once instead of a code from your app. This is the only time we show them:
        we keep a scrambled version that cannot be turned back into the codes.
      </p>
      <ul className={styles.codes} aria-label="Recovery codes">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className={`${base.actions} ${styles.noPrint}`}>
        <button type="button" className="button secondary small" onClick={download}>Download</button>
        <button
          type="button"
          className="button secondary small"
          onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined)}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="button secondary small" onClick={() => window.print()}>Print</button>
      </div>
      <div className={styles.noPrint}>
        <label className={base.check}>
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved these codes somewhere safe.
        </label>
        <button type="button" className="button" disabled={!saved} onClick={onDone}>{doneLabel}</button>
      </div>
    </section>
  );
}

/** A date in the viewer's own time zone. The server renders UTC, so the text may change after load. */
export function When({ iso, withTime = true }: { iso: string; withTime?: boolean }) {
  const d = new Date(iso);
  const text = d.toLocaleString(undefined, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}
