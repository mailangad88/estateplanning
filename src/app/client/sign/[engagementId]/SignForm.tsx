"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./sign.module.css";

interface Props {
  engagementId: string;
  documentSha256: string;
  signer: { role: "client" | "spouse"; name: string };
  /** The other spouse, when they still have to sign */
  nextSigner?: string;
  disclosure: { heading: string; points: string[] };
  consentText: string;
  intentText: string;
}

/** One signer's consent, typed name and intent. The page refreshes after each signature. */
export function SignForm({ engagementId, documentSha256, signer, nextSigner, disclosure, consentText, intentText }: Props) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [intent, setIntent] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = consent && intent && typedName.trim().length > 1;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/client/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ engagementId, signerRole: signer.role, typedName, consent, intent, documentSha256 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
      // Once everyone has signed, the confirmation shows at the top of the page: take them there
      if (json.complete) window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <form
      className={styles.sign}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void submit();
      }}
    >
      <h2>{signer.role === "spouse" ? `Signing as ${signer.name}` : nextSigner ? `Signing as ${signer.name}` : "Sign your agreement"}</h2>
      {nextSigner && <p className={styles.small}>{nextSigner} signs next, right after you, on this device or later.</p>}

      <div className={styles.disclosure}>
        <strong>{disclosure.heading}</strong>
        <ul>{disclosure.points.map((p) => <li key={p}>{p}</li>)}</ul>
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{consentText}</span>
      </label>

      <label className={styles.nameField} htmlFor={`name-${signer.role}`}>Type your full name to sign</label>
      <input
        id={`name-${signer.role}`}
        className={styles.nameInput}
        value={typedName}
        onChange={(e) => setTypedName(e.target.value)}
        autoComplete="name"
        placeholder={signer.name}
        aria-describedby={`hint-${signer.role}`}
      />
      <p id={`hint-${signer.role}`} className={styles.hint}>As it appears on the agreement: {signer.name}</p>

      <label className={styles.check}>
        <input type="checkbox" checked={intent} onChange={(e) => setIntent(e.target.checked)} />
        <span>{intentText}</span>
      </label>

      <button className={`button ${styles.signButton}`} type="submit" disabled={!ready || busy}>
        {busy ? "Signing…" : "Sign"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      <p className={styles.small}>Not ready? You can come back to this page any time before the link expires, or ask the office for a paper copy.</p>
    </form>
  );
}
