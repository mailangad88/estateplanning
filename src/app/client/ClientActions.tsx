"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
}

function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function MessageForm() {
  const { busy, error, run } = useSubmit();
  const [body, setBody] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); void run(async () => { await post("/api/client/messages", { body }); setBody(""); }); }}>
      <label htmlFor="msg">Message your attorney's office</label>
      <textarea id="msg" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
      <button className="button" type="submit" disabled={busy || !body.trim()}>Send</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

export function UploadForm({ options }: { options: { value: string; label: string }[] }) {
  const { busy, error, run } = useSubmit();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState(options[0]?.value ?? "other");
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!file) return;
      // TODO: after registering, request a signed URL and PUT the file bytes to storage. Today only the file details are recorded.
      void run(async () => { await post("/api/client/documents", { name: file.name, kind, contentType: file.type, sizeBytes: file.size }); setFile(null); });
    }}>
      <label htmlFor="kind">What is this?</label>
      <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <label htmlFor="file">Choose a PDF, Word file or photo (up to 25 MB)</label>
      <input id="file" type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png,image/heic" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button className="button" type="submit" disabled={busy || !file}>Upload</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
