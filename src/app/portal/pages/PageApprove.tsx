"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PageItem {
  path: string;
  title: string;
  hash: string;
  words: number;
  reasons: string[];
  aiFlag?: string;
  /** Set when an earlier version of the page was approved. */
  changedSince?: string;
}

interface Edits {
  title: string;
  description: string;
  body: string;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json as T;
}

async function post(pages: PageItem[], confirmed: boolean, note: string, edits?: Edits) {
  await call("/api/portal/pages/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pages: pages.map((p) => ({ path: p.path, contentHash: p.hash })), confirmed, note, edits }),
  });
}

function PageLine({ p }: { p: PageItem }) {
  return (
    <>
      <a href={p.path} target="_blank" rel="noreferrer"><strong>{p.title}</strong></a>{" "}
      <span className="notice">{p.path} · {p.words.toLocaleString()} words</span>
      {p.changedSince && <p className="error" style={{ margin: "4px 0" }}>Changed since you approved it on {p.changedSince}. Read it again.</p>}
      {p.aiFlag && <p className="error" style={{ margin: "4px 0" }}>AI-text flag: {p.aiFlag}</p>}
      {p.reasons.filter((r) => r !== p.aiFlag).length > 0 && (
        <p className="notice" style={{ margin: "2px 0" }}>Why it is high in the queue: {p.reasons.filter((r) => r !== p.aiFlag).join("; ")}</p>
      )}
    </>
  );
}

/** A batch of low- or medium-risk pages. Every page starts ticked; untick any you have not read or do not approve. */
export function BatchApprove({ label, pages }: { label: string; pages: PageItem[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(pages.map((p) => p.path)));
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = pages.filter((p) => picked.has(p.path));

  const toggle = (path: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await post(chosen, confirmed, note);
      setConfirmed(false);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{label} <span className="notice">({pages.length} pages)</span></h3>
      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {pages.map((p) => (
          <li key={p.path} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
            <input type="checkbox" checked={picked.has(p.path)} onChange={() => toggle(p.path)} aria-label={`Include ${p.title}`} style={{ marginTop: 5 }} />
            <div><PageLine p={p} /></div>
          </li>
        ))}
      </ul>
      <label className="field">
        Note (optional)
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I read each page in this batch
      </label>
      <button className="button" disabled={busy || !confirmed || chosen.length === 0} onClick={() => void approve()}>
        I reviewed these {chosen.length} pages and approve them
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}

const HIGH_CHECKS = [
  "Every dollar figure, threshold and date is current and matches its source",
  "Every statute or rule cited is right for the state and still in force",
  "State variation is flagged wherever the answer differs by state",
  "Nothing reads as advice for the reader's own situation",
];

/**
 * One medium- or high-risk page. No batch approval for these. With GitHub publishing configured the attorney can
 * edit the title, description and body first; the pull request then carries the edited file.
 */
export function SingleApprove({ page, canEdit }: { page: PageItem; canEdit: boolean }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [original, setOriginal] = useState<Edits | null>(null);
  const [edits, setEdits] = useState<Edits | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const changed = !!edits && !!original && (edits.title !== original.title || edits.description !== original.description || edits.body !== original.body);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openEditor = () =>
    run(async () => {
      const src = await call<Edits & { hash: string }>(`/api/portal/pages/source?path=${encodeURIComponent(page.path)}`);
      if (src.hash !== page.hash) throw new Error("This page changed since the list loaded. Reload and read the new version.");
      const parts = { title: src.title, description: src.description, body: src.body };
      setOriginal(parts);
      setEdits(parts);
    });

  const showPreview = () =>
    run(async () => {
      const res = await call<{ html: string }>("/api/portal/pages/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: page.path, body: edits?.body ?? "" }),
      });
      setPreview(res.html);
    });

  const approve = () =>
    run(async () => {
      await post([page], confirmed, note, changed ? edits! : undefined);
      router.refresh();
    });

  return (
    <article className="card" style={{ marginBottom: 12 }}>
      <PageLine p={page} />
      <details style={{ margin: "8px 0" }}>
        <summary>Before you approve</summary>
        <ul>{HIGH_CHECKS.map((c) => <li key={c}>{c}</li>)}</ul>
      </details>
      {canEdit && !edits && (
        <p><button className="button secondary" disabled={busy} onClick={() => void openEditor()}>Edit before approving</button></p>
      )}
      {edits && (
        <div style={{ margin: "8px 0" }}>
          <label className="field">
            Title
            <input value={edits.title} onChange={(e) => setEdits({ ...edits, title: e.target.value })} />
          </label>
          <label className="field">
            Description
            <textarea rows={2} value={edits.description} onChange={(e) => setEdits({ ...edits, description: e.target.value })} />
          </label>
          <label className="field">
            Page text (markdown)
            <textarea rows={18} value={edits.body} onChange={(e) => { setEdits({ ...edits, body: e.target.value }); setPreview(null); }} style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.9rem" }} />
          </label>
          <p className="notice">Other frontmatter (facts, FAQs, related pages) is edited in the repo, not here.</p>
          <p>
            <button className="button secondary" disabled={busy} onClick={() => void showPreview()}>Preview</button>{" "}
            <button className="button secondary" disabled={busy} onClick={() => { setEdits(original); setPreview(null); }}>Undo my edits</button>
          </p>
          {preview !== null && (
            <div className="card prose" style={{ background: "var(--surface, #fff)", maxHeight: 480, overflow: "auto" }}>
              <h2 style={{ marginTop: 0 }}>{edits.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          )}
        </div>
      )}
      <label className="field">
        Note (optional)
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I read this page line by line
      </label>
      <button className="button secondary" disabled={busy || !confirmed} onClick={() => void approve()} aria-label={`Approve ${page.title}`}>
        {changed ? "Approve with my edits" : "Approve this page"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}
