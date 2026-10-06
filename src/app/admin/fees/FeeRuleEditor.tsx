"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FeeRule } from "@/lib/fees";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json;
}

/** Edits one rule's terms. Every save needs a reason and creates a new version. */
export function FeeRuleEditor({ rule, canApprove }: { rule: FeeRule; canApprove: boolean }) {
  const router = useRouter();
  const usesPercent = rule.feeType === "percent_of_fee" || rule.feeType === "ad_spend_passthrough" || rule.feeType === "comp_plan_accrual";
  const [value, setValue] = useState(String(usesPercent ? (rule.percent ?? 0) : (rule.amountCents ?? 0) / 100));
  const [effectiveFrom, setEffectiveFrom] = useState(rule.effectiveFrom);
  const [reason, setReason] = useState("");
  const [counsel, setCounsel] = useState({ name: "", opinionRef: "", approvedOn: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const n = Number(value);
    const { counselApprovedAt: _c, ...terms } = rule;
    const next = usesPercent ? { ...terms, percent: n } : { ...terms, amountCents: Math.round(n * 100) };
    return run(() => post("/api/admin/fee-rules", { rule: { ...next, effectiveFrom }, reason }));
  };

  return (
    <div>
      <div className="nav">
        <label className="field">
          {usesPercent ? "Percent" : "Amount ($)"}
          <input type="number" min={0} max={usesPercent ? 100 : undefined} step="any" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="field">
          Effective from
          <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </label>
      </div>
      <label className="field">
        Reason for the change
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required, kept in the history" />
      </label>
      <button className="button secondary" disabled={busy || !reason.trim()} onClick={save}>Save new version</button>
      {canApprove && (
        <details>
          <summary>Record ethics counsel approval</summary>
          <p className="notice">Only for fee types this structure allows with counsel approval. Prohibited types cannot be approved.</p>
          <label className="field">Counsel name<input value={counsel.name} onChange={(e) => setCounsel({ ...counsel, name: e.target.value })} /></label>
          <label className="field">Opinion reference<input value={counsel.opinionRef} onChange={(e) => setCounsel({ ...counsel, opinionRef: e.target.value })} /></label>
          <label className="field">Approved on<input type="date" value={counsel.approvedOn} onChange={(e) => setCounsel({ ...counsel, approvedOn: e.target.value })} /></label>
          <button className="button secondary" disabled={busy} onClick={() => run(() => post(`/api/admin/fee-rules/${rule.id}/counsel-approval`, counsel))}>Record approval</button>
        </details>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
