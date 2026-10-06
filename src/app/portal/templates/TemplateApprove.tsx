"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Approves the exact copy shown. The server rejects it if the copy changed in the meantime. */
export function TemplateApprove({ templateKey, contentHash, changed }: { templateKey: string; contentHash: string; changed: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/templates/${encodeURIComponent(templateKey)}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentHash, note }),
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
        Note (optional)
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="button secondary" disabled={busy} onClick={approve} aria-label={`Approve ${templateKey}`}>
        {changed ? "Approve the changed copy" : "Approve this copy"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
