"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Approves the exact value shown. The server rejects it if the value changed in the meantime. */
export function FactApprove({ factId, value, needsNote, label }: { factId: string; value: string; needsNote: boolean; label: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/facts/${encodeURIComponent(factId)}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="field">
        Note{needsNote ? " (required: which source you checked)" : " (optional)"}
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="button secondary" disabled={busy || (needsNote && !note.trim())} onClick={approve} aria-label={`Approve ${label}`}>
        Approve this value
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
