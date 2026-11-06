"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./referral.module.css";

type Option = { value: string; label: string };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (url: string, body: unknown, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await post(url, body);
      after?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

const RESULTS_BY_CHANNEL: Record<string, string[]> = {
  call: ["reached", "voicemail", "no_answer", "wrong_number"],
  sms: ["sent", "replied", "wrong_number"],
  email: ["sent", "replied"],
};

interface WorkProps {
  leadId: string;
  attempts: number;
  stage: string;
  closed?: { label: string; note?: string; reopenable: boolean };
  /** Stages this viewer may still move the lead to by hand */
  moveTo: Option[];
  canClose: boolean;
  results: Option[];
  exitReasons: Option[];
}

/** Log a call, text or email; move the lead along; close or reopen it. */
export function LeadWork({ leadId, attempts, closed, moveTo, canClose, results, exitReasons }: WorkProps) {
  const { busy, error, run } = useAction();
  const [channel, setChannel] = useState("call");
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [result, setResult] = useState("reached");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [showClose, setShowClose] = useState(false);
  const allowed = direction === "inbound" ? RESULTS_BY_CHANNEL[channel].filter((r) => r === "reached" || r === "replied") : RESULTS_BY_CHANNEL[channel];
  const pick = (c: string, d: "outbound" | "inbound") => {
    setChannel(c);
    setDirection(d);
    const next = d === "inbound" ? RESULTS_BY_CHANNEL[c].filter((r) => r === "reached" || r === "replied") : RESULTS_BY_CHANNEL[c];
    if (!next.includes(result)) setResult(next[0]);
  };

  if (closed) {
    return (
      <div className={styles.panel}>
        <p><strong>Closed:</strong> {closed.label}{closed.note ? `. ${closed.note}` : ""}</p>
        {closed.reopenable && (
          <div className={styles.actions}>
            <button className="button secondary" disabled={busy} onClick={() => void run(`/api/portal/leads/${leadId}/stage`, { action: "reopen" })}>Reopen this lead</button>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.small}>
        Attempts so far: <strong>{attempts}</strong>. The playbook cadence is six touches over ten days, then close as &ldquo;Could not reach them&rdquo;.
      </p>
      <div className={styles.fields}>
        <label>
          How
          <select value={channel} onChange={(e) => pick(e.target.value, direction)}>
            <option value="call">Call</option>
            <option value="sms">Text</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label>
          Who started it
          <select value={direction} onChange={(e) => pick(channel, e.target.value as "outbound" | "inbound")}>
            <option value="outbound">We reached out</option>
            <option value="inbound">They contacted us</option>
          </select>
        </label>
        <label>
          What happened
          <select value={result} onChange={(e) => setResult(e.target.value)}>
            {results.filter((r) => allowed.includes(r.value)).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className={styles.wide}>
          Note (optional, no sensitive details)
          <textarea rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Married, 2 kids, wants guardians named. Call back Tue after 5." />
        </label>
      </div>
      <div className={styles.actions}>
        <button
          className="button"
          disabled={busy}
          onClick={() => void run(`/api/portal/leads/${leadId}/contact`, { channel, direction, result, note: note.trim() || undefined }, () => setNote(""))}
        >
          {busy ? "Saving…" : "Log it"}
        </button>
        {moveTo.map((s) => (
          <button key={s.value} className="button secondary" disabled={busy} onClick={() => void run(`/api/portal/leads/${leadId}/stage`, { action: "move", stage: s.value })}>
            Mark {s.label.toLowerCase()}
          </button>
        ))}
        {canClose && !showClose && <button className="button secondary" disabled={busy} onClick={() => setShowClose(true)}>Close this lead</button>}
      </div>
      {canClose && showClose && (
        <div className={styles.fields}>
          <label>
            Why
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose a reason</option>
              {exitReasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className={styles.wide}>
            Note (optional: price, timing, who they chose)
            <textarea rows={2} value={closeNote} maxLength={1000} onChange={(e) => setCloseNote(e.target.value)} />
          </label>
          <div className={`${styles.actions} ${styles.wide}`}>
            <button className="button" disabled={busy || !reason} onClick={() => void run(`/api/portal/leads/${leadId}/stage`, { action: "close", reason, note: closeNote.trim() || undefined }, () => setShowClose(false))}>
              Close lead
            </button>
            <button className="button secondary" disabled={busy} onClick={() => setShowClose(false)}>Cancel</button>
          </div>
          <p className={`${styles.small} ${styles.wide}`}>Need to send them to another attorney? Use &ldquo;Refer to another attorney&rdquo; instead, so the referral log has it.</p>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

interface ConsultRow {
  id: string;
  at: string;
  type: string;
  status: string;
}

/** Add a consult (booked on Cal.com or by phone) and record whether it happened. */
export function ConsultWork({ leadId, canBook, canRecord, consults }: { leadId: string; canBook: boolean; canRecord: boolean; consults: ConsultRow[] }) {
  const { busy, error, run } = useAction();
  const [at, setAt] = useState("");
  const [type, setType] = useState("phone");
  const booked = canRecord ? consults.filter((c) => c.status === "booked") : [];
  return (
    <div className={styles.panel}>
      {booked.map((c) => <OutcomeForm key={c.id} consult={c} />)}
      {canBook && (
        <div className={styles.fields}>
          <label>
            Consult time
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </label>
          <label>
            How
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="phone">Phone</option>
              <option value="video">Video</option>
              <option value="office">In person</option>
            </select>
          </label>
          <div className={`${styles.actions} ${styles.wide}`}>
            <button className="button secondary" disabled={busy || !at} onClick={() => void run(`/api/portal/leads/${leadId}/consults`, { at: new Date(at).toISOString(), type }, () => setAt(""))}>
              {busy ? "Saving…" : "Add consult"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function OutcomeForm({ consult }: { consult: ConsultRow }) {
  const { busy, error, run } = useAction();
  const [status, setStatus] = useState("held");
  const [outcome, setOutcome] = useState("proposal");
  const [notes, setNotes] = useState("");
  const when = new Date(consult.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className={styles.fields}>
      <p className={`${styles.wide} ${styles.small}`}>Consult {when} ({consult.type}): what happened?</p>
      <label>
        Did it happen
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="held">Held</option>
          <option value="no_show">No-show</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      {status === "held" && (
        <label>
          Result
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="proposal">Wants to go ahead (send the retainer)</option>
            <option value="not_now">Not now (follow up later)</option>
            <option value="not_a_fit">Not a fit</option>
          </select>
        </label>
      )}
      <label className={styles.wide}>
        Notes (optional)
        <textarea rows={2} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className={`${styles.actions} ${styles.wide}`}>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void run(`/api/portal/consults/${consult.id}/outcome`, { status, outcome: status === "held" ? outcome : undefined, notes: notes.trim() || undefined })}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className={`error ${styles.wide}`} role="alert">{error}</p>}
    </div>
  );
}
