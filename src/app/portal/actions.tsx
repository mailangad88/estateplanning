"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function OfferActions({ assignmentId }: { assignmentId: string }) {
  const { busy, error, run } = useAction();
  const [reason, setReason] = useState("");
  return (
    <div className="card">
      <p>Accepting unlocks the full case. Decline if there is a conflict, you have no capacity, or it is out of scope.</p>
      <div className="nav">
        <button className="button" disabled={busy} onClick={() => run(() => post(`/api/portal/offers/${assignmentId}/accept`))}>Accept</button>
        <span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for declining">
            <option value="">Reason for declining</option>
            <option value="conflict">Conflict</option>
            <option value="capacity">No capacity</option>
            <option value="out_of_scope">Out of scope</option>
            <option value="other">Other</option>
          </select>{" "}
          <button className="button secondary" disabled={busy || !reason} onClick={() => run(() => post(`/api/portal/offers/${assignmentId}/decline`, { reason }))}>Decline</button>
        </span>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function CommentForm({ leadId, visibilities, parentId }: { leadId: string; visibilities: string[]; parentId?: string }) {
  const { busy, error, run } = useAction();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState(visibilities.includes("firm") ? "firm" : visibilities[0]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await post(`/api/portal/leads/${leadId}/comments`, { body, visibility, parentId });
          setBody("");
        });
      }}
    >
      <label className="field">
        {parentId ? "Reply" : "Add a comment"}
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {visibilities.length > 1 && (
        <label className="field">
          Who can see it
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            {visibilities.map((v) => (
              <option key={v} value={v}>{v === "internal" ? "Intake team only" : v === "firm" ? "Firm and intake" : "Client too"}</option>
            ))}
          </select>
        </label>
      )}
      <button className="button secondary" disabled={busy || !body.trim()}>Post</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

export function ApproveEngagement({ engagementId, status }: { engagementId: string; status: string }) {
  const { busy, error, run } = useAction();
  return (
    <span>
      {status === "draft" && <button className="button" disabled={busy} onClick={() => run(() => post(`/api/portal/engagements/${engagementId}/approve`))}>Approve</button>}
      {status === "approved" && <button className="button" disabled={busy} onClick={() => run(() => post(`/api/portal/engagements/${engagementId}/send`))}>Send for signature</button>}
      {error && <span className="error"> {error}</span>}
    </span>
  );
}
