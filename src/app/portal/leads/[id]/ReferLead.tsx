"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./referral.module.css";

export interface ReferralLogRow {
  id: string;
  referredAt: string;
  fromName: string;
  toName: string;
  outside: boolean;
  reasonLabel: string;
  note?: string;
  outcome: string;
  outcomeLabel: string;
  outcomeNote?: string;
  canUpdate: boolean;
}

interface Props {
  leadId: string;
  /** False when this viewer can see the log but not refer */
  canRefer: boolean;
  /** Outside the platform needs the whole case; an offer-stage attorney can only pass it to a platform attorney */
  canReferOutside: boolean;
  holderName?: string;
  targets: { lawyerId: string; name: string; blockedBy?: string }[];
  reasons: { value: string; label: string }[];
  outcomes: { value: string; label: string }[];
  log: ReferralLogRow[];
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
const tone = (o: string) => (o === "retained" || o === "booked" || o === "accepted" ? "good" : o === "declined" || o === "no_response" ? "bad" : undefined);

function OutcomeEditor({ row, outcomes }: { row: ReferralLogRow; outcomes: Props["outcomes"] }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState(row.outcome);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await post(`/api/portal/referrals/${row.id}/outcome`, { outcome });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.outcomeRow}>
      <select aria-label="What happened" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
        {outcomes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button className="button secondary" disabled={busy || outcome === row.outcome} onClick={() => void save()}>{busy ? "Saving…" : "Update"}</button>
      {error && <span className="error" role="alert">{error}</span>}
    </div>
  );
}

/** The referral log on a lead, plus "Refer to another attorney" for whoever holds it. */
export function ReferLead({ leadId, canRefer, canReferOutside, holderName, targets, reasons, outcomes, log }: Props) {
  const router = useRouter();
  const open = targets.filter((t) => !t.blockedBy);
  const [kind, setKind] = useState<"platform" | "outside">(open.length || !canReferOutside ? "platform" : "outside");
  const [lawyerId, setLawyerId] = useState(open[0]?.lawyerId ?? "");
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [contact, setContact] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = !!reason && agreed && (kind === "platform" ? !!lawyerId : !!name.trim());
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await post(`/api/portal/leads/${leadId}/referrals`, {
        target: kind === "platform" ? { kind, lawyerId } : { kind, name, firm: firm || undefined, contact: contact || undefined },
        reason,
        note: note || undefined,
        clientAgreed: agreed,
      });
      setShowForm(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {log.length === 0 ? (
        <p className={styles.small}>{holderName ? `${holderName} is handling this lead. Nothing has been referred.` : "Nothing has been referred."}</p>
      ) : (
        <ol className={styles.log}>
          {log.map((r) => (
            <li key={r.id}>
              <p>
                <strong>{r.fromName}</strong> → <strong>{r.toName}</strong>{r.outside ? " (outside the platform)" : ""}{" "}
                <span className={styles.badge} data-tone={tone(r.outcome)}>{r.outcomeLabel}</span>
              </p>
              <p className={styles.small}>{when(r.referredAt)} · {r.reasonLabel}{r.note ? ` · ${r.note}` : ""}{r.outcomeNote ? ` · ${r.outcomeNote}` : ""}</p>
              {r.canUpdate && <OutcomeEditor row={r} outcomes={outcomes} />}
              {!r.outside && <p className={styles.small}>Updates itself as {r.toName.split(",")[0]} responds.</p>}
            </li>
          ))}
        </ol>
      )}

      {canRefer && !showForm && (
        <button className="button secondary" onClick={() => setShowForm(true)}>Refer to another attorney</button>
      )}
      {canRefer && showForm && (
        <div className={styles.panel}>
          <div className={styles.choice} role="radiogroup" aria-label="Who are you referring to">
            <label><input type="radio" name="kind" checked={kind === "platform"} onChange={() => setKind("platform")} /> An attorney on the platform</label>
            {canReferOutside && <label><input type="radio" name="kind" checked={kind === "outside"} onChange={() => setKind("outside")} /> Someone outside the platform</label>}
          </div>
          <div className={styles.fields}>
            {kind === "platform" ? (
              <label className={styles.wide}>
                Attorney
                <select value={lawyerId} onChange={(e) => setLawyerId(e.target.value)}>
                  {open.length === 0 && <option value="">Nobody on the platform can take it</option>}
                  {targets.map((t) => (
                    <option key={t.lawyerId} value={t.lawyerId} disabled={!!t.blockedBy}>{t.name}{t.blockedBy ? ` (${t.blockedBy})` : ""}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label>Attorney&apos;s name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></label>
                <label>Firm (optional)<input value={firm} onChange={(e) => setFirm(e.target.value)} maxLength={200} /></label>
                <label>Phone or email (optional)<input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} /></label>
              </>
            )}
            <label>
              Why
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Choose a reason</option>
                {reasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label className={styles.wide}>Note (optional)<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></label>
          </div>
          <label className={styles.agree}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>The client agreed to their details going to this attorney.</span>
          </label>
          <p className={styles.small}>
            {kind === "platform"
              ? "They get an offer now, with the same response time as any lead. If they pass, it routes on automatically."
              : "The lead leaves your pipeline. Come back and record what happened when you hear."}
          </p>
          <div className={styles.actions}>
            <button className="button" disabled={busy || !ready} onClick={() => void submit()}>{busy ? "Referring…" : "Refer"}</button>
            <button className="button secondary" disabled={busy} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      )}
    </>
  );
}
