"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Script, ScriptBeat } from "@/server/studio/types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const msg = await fn();
      if (msg) setDone(msg);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, done, run };
}

function Status({ error, done }: { error: string | null; done: string | null }) {
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {done && <p className="notice" role="status">{done}</p>}
    </>
  );
}

export function GenerateForm({ writer }: { writer: string }) {
  const [format, setFormat] = useState<"short" | "long">("short");
  const [count, setCount] = useState(3);
  const { busy, error, done, run } = useAction();
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          const r = await call<{ made: { stage: string }[] }>("/api/admin/studio/drafts", jsonInit("POST", { format, count }));
          const ok = r.made.filter((m) => m.stage === "in_review").length;
          return `${r.made.length} drafted: ${ok} ready for review, ${r.made.length - ok} need a rewrite.`;
        });
      }}
    >
      <h2 style={{ marginTop: 0 }}>Make new drafts</h2>
      <p className="notice">Writer: {writer}. Topics come from the question bank, Illinois first, never repeated.</p>
      <label className="field">
        Format{" "}
        <select value={format} onChange={(e) => setFormat(e.target.value as "short" | "long")}>
          <option value="short">Short (YouTube Shorts and Instagram Reels)</option>
          <option value="long">Long YouTube video</option>
        </select>
      </label>{" "}
      <label className="field">
        How many{" "}
        <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 64 }} />
      </label>{" "}
      <button className="button small" disabled={busy}>{busy ? "Writing…" : "Draft"}</button>
      <Status error={error} done={done} />
    </form>
  );
}

export function ReviewForm({ id, contentHash, attorney }: { id: string; contentHash: string; attorney: boolean }) {
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const { busy, error, done, run } = useAction();
  const send = (decision: "approved" | "changes_requested" | "rejected") =>
    run(async () => {
      await call(`/api/admin/studio/videos/${id}/review`, jsonInit("POST", { decision, contentHash, note, confirmed }));
      return decision === "approved" ? "Approved. It will be rendered and given the next open slot." : "Sent back with your note.";
    });
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Your review</h2>
      {!attorney && <p className="error" role="note">You are signed in as a platform admin. Your decision is recorded, but only an attorney&apos;s approval clears a video to publish.</p>}
      <p className="notice">An approval covers this exact script and video. Any edit afterwards needs a new approval.</p>
      <label className="field" style={{ display: "block", marginBottom: 8 }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I watched the preview or read the whole script, and the facts are right for Illinois.
      </label>
      <label className="field" style={{ display: "block" }}>
        Note (required to send back)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ width: "100%" }} />
      </label>
      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="button small" disabled={busy || !confirmed} onClick={() => void send("approved")}>Approve</button>
        <button className="button small secondary" disabled={busy || !note.trim()} onClick={() => void send("changes_requested")}>Send back</button>
        <button className="button small secondary" disabled={busy || !note.trim()} onClick={() => void send("rejected")}>Reject</button>
      </p>
      <Status error={error} done={done} />
    </section>
  );
}

export function PostButton({ url, label, confirm, secondary }: { url: string; label: string; confirm?: string; secondary?: boolean }) {
  const { busy, error, done, run } = useAction();
  return (
    <span>
      <button
        className={`button small${secondary ? " secondary" : ""}`}
        disabled={busy}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          void run(async () => {
            await call(url, { method: "POST" });
          });
        }}
      >
        {busy ? "Working…" : label}
      </button>
      <Status error={error} done={done} />
    </span>
  );
}

const ROLE_LABEL: Record<ScriptBeat["role"], string> = { hook: "Hook", question: "Question", answer: "Answer", example: "Example", steps: "Steps", myth: "Myth vs fact", next_step: "Next step", cta: "Call to action" };

export function ScriptEditor({ id, script }: { id: string; script: Script }) {
  const [draft, setDraft] = useState<Script>(script);
  const [open, setOpen] = useState(false);
  const { busy, error, done, run } = useAction();
  const setBeat = (i: number, patch: Partial<ScriptBeat>) => setDraft({ ...draft, beats: draft.beats.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  if (!open) return <button className="button small secondary" onClick={() => setOpen(true)}>Edit script</button>;
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Edit script</h2>
      <p className="notice">Saving re-runs the checks and clears any approval.</p>
      <label className="field" style={{ display: "block" }}>
        Title
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ width: "100%" }} />
      </label>
      <label className="field" style={{ display: "block" }}>
        Description
        <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} style={{ width: "100%" }} />
      </label>
      {draft.beats.map((b, i) => (
        <fieldset key={b.id} style={{ margin: "12px 0" }}>
          <legend>{b.id} · {ROLE_LABEL[b.role]}{b.fictional ? " · fictional" : ""}</legend>
          <label className="field" style={{ display: "block" }}>
            On screen
            <input value={b.onScreen} onChange={(e) => setBeat(i, { onScreen: e.target.value })} style={{ width: "100%" }} />
          </label>
          <label className="field" style={{ display: "block" }}>
            Narration
            <textarea value={b.narration} onChange={(e) => setBeat(i, { narration: e.target.value })} rows={3} style={{ width: "100%" }} />
          </label>
          {b.points && (
            <label className="field" style={{ display: "block" }}>
              Points (one per line)
              <textarea value={b.points.join("\n")} onChange={(e) => setBeat(i, { points: e.target.value.split("\n").filter(Boolean) })} rows={3} style={{ width: "100%" }} />
            </label>
          )}
        </fieldset>
      ))}
      <p style={{ display: "flex", gap: 8 }}>
        <button className="button small" disabled={busy} onClick={() => void run(async () => {
          const r = await call<{ passed: boolean }>(`/api/admin/studio/videos/${id}/script`, jsonInit("PUT", { script: draft }));
          setOpen(false);
          return r.passed ? "Saved. It is back in the review queue." : "Saved, but it fails a check. See the checks below.";
        })}>Save</button>
        <button className="button small secondary" disabled={busy} onClick={() => { setDraft(script); setOpen(false); }}>Cancel</button>
      </p>
      <Status error={error} done={done} />
    </section>
  );
}

export function SettingsForm({ longSlots, shortSlots, bufferDays }: { longSlots: string[]; shortSlots: string[]; bufferDays: number }) {
  const [long, setLong] = useState(longSlots.join(", "));
  const [short, setShort] = useState(shortSlots.join(", "));
  const [buffer, setBuffer] = useState(bufferDays);
  const { busy, error, done, run } = useAction();
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void run(async () => { await call("/api/admin/studio/settings", jsonInit("PUT", { longSlots: long, shortSlots: short, bufferDays: buffer })); return "Saved."; }); }}>
      <h2 style={{ marginTop: 0 }}>Publish times (Chicago time)</h2>
      <label className="field" style={{ display: "block" }}>
        Long videos, one per time
        <input value={long} onChange={(e) => setLong(e.target.value)} style={{ width: "100%" }} />
      </label>
      <label className="field" style={{ display: "block" }}>
        Shorts, one per time (each goes to YouTube Shorts and Instagram Reels)
        <input value={short} onChange={(e) => setShort(e.target.value)} style={{ width: "100%" }} />
      </label>
      <label className="field" style={{ display: "block" }}>
        Days of drafts to keep ahead{" "}
        <input type="number" min={1} max={14} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} style={{ width: 64 }} />
      </label>
      <button className="button small" disabled={busy}>Save times</button>
      <Status error={error} done={done} />
    </form>
  );
}
