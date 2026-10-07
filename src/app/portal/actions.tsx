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
        void run(async () => {
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
      {(status === "signed" || status === "paid") && <button className="button" disabled={busy} onClick={() => run(() => post(`/api/portal/engagements/${engagementId}/countersign`))}>Countersign</button>}
      {error && <span className="error"> {error}</span>}
    </span>
  );
}

/** Attorney-only: refunds all or part of a paid payment. The amount is in dollars here and sent as cents. */
export function RefundPayment({ paymentId, maxCents }: { paymentId: string; maxCents: number }) {
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [dollars, setDollars] = useState((maxCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  if (maxCents <= 0) return null;
  if (!open) return <button className="button secondary" onClick={() => setOpen(true)}>Refund</button>;
  const cents = Math.round(Number(dollars) * 100);
  return (
    <span>
      <label>Amount <input inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} /></label>{" "}
      <label>Reason <input value={reason} onChange={(e) => setReason(e.target.value)} /></label>{" "}
      <button className="button" disabled={busy || !reason.trim() || !(cents > 0 && cents <= maxCents)} onClick={() => run(() => post(`/api/portal/payments/${paymentId}/refund`, { amountCents: cents, reason }))}>Confirm refund</button>
      {error && <span className="error"> {error}</span>}
    </span>
  );
}

/** Creates a single-use invite to the client portal. The link is shown for the team to send; nothing is emailed from here. */
export function InviteClient({ leadId }: { leadId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const invite = async () => {
    setBusy(true);
    setError(null);
    try {
      const json = (await post("/api/client/invite", { leadId })) as { link: string };
      setLink(json.link);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button className="button secondary" disabled={busy} onClick={() => void invite()}>Invite client to their portal</button>
      {link && <p className="notice">Send this single-use link to the client: <code>{link}</code></p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
