"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClaimButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/queue/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <span>
      <button className="button secondary" disabled={busy} onClick={claim}>Claim</button>
      {error && <span className="error"> {error}</span>}
    </span>
  );
}
