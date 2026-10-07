"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fieldLabel, type MergeFieldKey, type Segment } from "@/lib/retainerTemplates";
import { LetterPreview } from "@/app/portal/retainers/LetterPreview";
import styles from "./send.module.css";

interface Tier { id: string; name: string; defaultCents: number }

interface Props {
  leadId: string;
  clientFirstName: string;
  tiers: Tier[];
  defaultTierId: string;
  /** A spouse named at intake: preselects joint signing */
  spouseName?: string;
  /** Attorneys approve and send in one click; a paralegal prepares it for the attorney */
  canApprove: boolean;
  planAllowed: boolean;
}

interface Preview {
  template: { id: string; name: string; version: number; pdf: { name: string; sizeBytes: number } | null } | null;
  segments: Segment[];
  missing: MergeFieldKey[];
  feeCents: number;
  packageName: string;
  payment: string | null;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json as T;
}

const dollars = (cents: number) => String(Math.round(cents / 100));

/** "Send retainer": opens with everything filled from the lead; the lawyer fills any highlighted gap, then sends. */
export function SendRetainer({ leadId, clientFirstName, tiers, defaultTierId, spouseName, canApprove, planAllowed }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tierId, setTierId] = useState(defaultTierId);
  const [price, setPrice] = useState(dollars(tiers.find((t) => t.id === defaultTierId)?.defaultCents ?? 0));
  const [mode, setMode] = useState<"full" | "plan">("full");
  const [deposit, setDeposit] = useState("");
  const [months, setMonths] = useState("3");
  const [couple, setCouple] = useState(!!spouseName);
  const [spouse, setSpouse] = useState(spouseName ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ status: string; link?: string; delivered?: boolean; id: string } | null>(null);

  const cents = Math.round(Number(price) * 100);
  const depositCents = Math.round(Number(deposit || Math.ceil(Number(price) * 0.25)) * 100);
  const body = {
    terms: { tierId, tierPriceCents: cents, plan: mode === "full" ? { mode: "full" } : { mode: "plan", depositCents, installments: Number(months) } },
    spouseName: couple ? spouse : undefined,
    mergeValues: values,
  };
  const key = JSON.stringify(body);

  useEffect(() => {
    if (!open || !(cents > 0)) return;
    const t = setTimeout(() => {
      post<Preview>(`/api/portal/leads/${leadId}/retainer/preview`, JSON.parse(key))
        .then((p) => { setPreview(p); setError(null); })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [open, key, leadId, cents]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ id: string; status: string; signingInvite?: { link: string; delivered: boolean } | null }>(`/api/portal/leads/${leadId}/retainer/send`, body);
      setDone({ id: r.id, status: r.status, link: r.signingInvite?.link, delivered: r.signingInvite?.delivered });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className={styles.done} role="status">
        {done.status === "draft" ? (
          <p><strong>Prepared.</strong> The attorney approves and sends it from this page.</p>
        ) : (
          <>
            <p><strong>Sent to {clientFirstName}.</strong> {done.delivered ? "They got an email with a link to read and sign it." : "The email is in dry-run mode (logged, not sent). Send them this single-use link yourself, by text or email:"}</p>
            {done.link && <p><code className={styles.link}>{done.link}</code></p>}
            <p className={styles.small}>You will be notified when it is signed. <a href={`/client/sign/${done.id}`}>See what {clientFirstName} sees</a></p>
          </>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <div className={styles.cta}>
        <button className="button" onClick={() => setOpen(true)}>Send retainer</button>
        <span className={styles.small}>Uses your firm&apos;s approved template for this matter, filled in with {clientFirstName}&apos;s details.</span>
      </div>
    );
  }

  const missing = preview?.missing ?? [];
  return (
    <section className={styles.panel} aria-label="Send retainer">
      <div className={styles.terms}>
        <label>
          Package
          <select value={tierId} onChange={(e) => { setTierId(e.target.value); setPrice(dollars(tiers.find((t) => t.id === e.target.value)?.defaultCents ?? 0)); }}>
            {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label>
          Flat fee ($)
          <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <label>
          Payment
          <select value={mode} onChange={(e) => setMode(e.target.value as "full" | "plan")}>
            <option value="full">Pay in full</option>
            {planAllowed && <option value="plan">Deposit + monthly</option>}
          </select>
        </label>
        {mode === "plan" && (
          <>
            <label>
              Deposit ($)
              <input inputMode="numeric" value={deposit} placeholder={String(Math.ceil(Number(price) * 0.25))} onChange={(e) => setDeposit(e.target.value.replace(/[^\d.]/g, ""))} />
            </label>
            <label>
              Months
              <select value={months} onChange={(e) => setMonths(e.target.value)}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </>
        )}
      </div>
      <label className={styles.couple}>
        <input type="checkbox" checked={couple} onChange={(e) => setCouple(e.target.checked)} />
        Joint representation: both spouses sign
        {couple && <input aria-label="Spouse's full name" value={spouse} onChange={(e) => setSpouse(e.target.value)} placeholder="Spouse's full name" />}
      </label>

      {preview && (
        <p className={styles.small}>
          {preview.template
            ? <>Template: <strong>{preview.template.name}</strong> v{preview.template.version}{preview.template.pdf ? ` + ${preview.template.pdf.name}` : ""}</>
            : <>Your firm has no approved template for this matter yet, so this is the platform&apos;s draft letter. <a href="/portal/retainers">Add your own</a></>}
        </p>
      )}
      {preview ? <LetterPreview segments={preview.segments} onMissingClick={(f) => document.getElementById(`mf-${f}`)?.focus()} /> : <p className={styles.small}>Filling in the letter…</p>}

      {missing.length > 0 && (
        <div className={styles.missing}>
          <p><strong>Fill in {missing.length === 1 ? "this" : `these ${missing.length}`} before sending</strong> (the client did not give {missing.length === 1 ? "it" : "them"} at intake):</p>
          {missing.map((f) => (
            <label key={f}>
              {fieldLabel(f)}
              <input id={`mf-${f}`} value={values[f] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))} />
            </label>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button className="button" disabled={busy || !preview || missing.length > 0 || !(cents > 0) || (couple && !spouse.trim())} onClick={() => void send()}>
          {busy ? "Sending…" : canApprove ? `Approve and send to ${clientFirstName}` : "Prepare for the attorney"}
        </button>
        <button className="linklike" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {canApprove && <p className={styles.small}>Sending records your approval of this letter and fee. {clientFirstName} signs online with the built-in e-sign; no third-party fee.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
