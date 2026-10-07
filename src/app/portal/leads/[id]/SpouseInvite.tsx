"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./send.module.css";

interface Props {
  engagementId: string;
  spouseFirstName: string;
  /** Where their own link went, once on file */
  emailHint?: string;
}

/**
 * Staff: "Waiting for Riley" plus their own invite. The second client signs only from their own link and
 * sign-in; this sends (or resends) it, optionally to a new address. In dry-run mode the link shows here to text.
 */
export function SpouseInvite({ engagementId, spouseFirstName, emailHint }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ emailHint: string; delivered: boolean; link?: string } | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/engagements/${engagementId}/spouse-invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setSent(json);
      setEmail("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.waiting}>
      <p>
        <strong>Waiting for {spouseFirstName}.</strong>{" "}
        {emailHint ? `${spouseFirstName} signs from their own link (${emailHint}).` : `Add ${spouseFirstName}'s email so they get their own link to sign.`}
      </p>
      <div className={styles.inviteRow}>
        <input type="email" aria-label={`${spouseFirstName}'s email`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={emailHint ? "New email (optional)" : `${spouseFirstName}'s email`} />
        <button className="button secondary" disabled={busy || (!emailHint && !email.trim())} onClick={() => void send()}>
          {busy ? "Sending…" : emailHint && !email.trim() ? `Resend ${spouseFirstName}'s link` : `Send ${spouseFirstName} their link`}
        </button>
      </div>
      {sent && (
        <>
          <p className={styles.small}>{sent.delivered ? `Sent to ${sent.emailHint}.` : `Email dry run (logged, not sent). Send ${spouseFirstName} this single-use link yourself:`}</p>
          {!sent.delivered && sent.link && <p><code className={styles.link}>{sent.link}</code></p>}
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
