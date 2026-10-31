"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./sign.module.css";

interface Props {
  engagementId: string;
  spouseFirstName: string;
  /** Where their link already went, if it did */
  emailHint?: string;
}

/**
 * The first client sends the second client their own link to sign. The link goes straight to the second
 * client's email and never shows here, so each signature comes from its own sign-in.
 */
export function SpouseLink({ engagementId, spouseFirstName, emailHint }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(!emailHint);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/engagements/${engagementId}/spouse-invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
      setSentTo(json.emailHint);
      setEditing(false);
      setEmail("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const hint = sentTo ?? emailHint;
  return (
    <section className={styles.spouse} aria-labelledby="spouse-h">
      <h3 id="spouse-h">{spouseFirstName} signs too, from their own link</h3>
      {hint && !editing ? (
        <>
          <p>{spouseFirstName}&apos;s own link goes to <strong>{hint}</strong>. They open it, confirm it is them, and sign. You do not need to do anything else.</p>
          <button type="button" className="linklike" onClick={() => setEditing(true)}>Wrong email? Change it</button>
        </>
      ) : (
        <>
          <p>So each signature is your own, {spouseFirstName} signs from a separate link sent to their own email.</p>
          <form
            className={styles.spouseRow}
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) void send();
            }}
          >
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-label={`${spouseFirstName}'s email`} placeholder={`${spouseFirstName}'s email`} autoComplete="off" />
            <button className="button secondary" type="submit" disabled={busy || !email.trim()}>{busy ? "Sending…" : `Send ${spouseFirstName} their link`}</button>
          </form>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
