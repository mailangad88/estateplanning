"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Platform, Recurrence, Script, ScriptBeat, Series } from "@/server/studio/types";
import styles from "./studio.module.css";

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

export function BufferForm({ bufferDays }: { bufferDays: number }) {
  const [buffer, setBuffer] = useState(bufferDays);
  const { busy, error, done, run } = useAction();
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void run(async () => { await call("/api/admin/studio/settings", jsonInit("PUT", { bufferDays: buffer })); return "Saved."; }); }}>
      <label className="field">
        Days of drafts to keep ahead of the schedule{" "}
        <input type="number" min={1} max={14} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} style={{ width: 64 }} />
      </label>{" "}
      <button className="button small" disabled={busy}>Save</button>
      <Status error={error} done={done} />
    </form>
  );
}

/* ---------- series: on/off switch and recurrence editor ---------- */

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function SeriesCard({ series, describe, canEdit }: { series: Series; describe: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction();
  const toggle = () =>
    run(async () => {
      await call(`/api/admin/studio/series/${series.id}`, jsonInit("PUT", { enabled: !series.enabled }));
    });
  return (
    <article className={styles.series}>
      <div className={styles.seriesHead}>
        <h3>{series.name}</h3>
        <button
          type="button"
          role="switch"
          aria-checked={series.enabled}
          aria-label={`${series.name} ${series.enabled ? "on" : "off"}`}
          className={styles.toggle}
          disabled={!canEdit || busy}
          onClick={() => void toggle()}
        />
      </div>
      <p className={styles.seriesWhen}>{describe}</p>
      <div className={styles.seriesFoot}>
        {canEdit ? (
          <button type="button" className={styles.linkButton} onClick={() => setOpen(true)}>
            <CalendarIcon /> Recurrence
          </button>
        ) : <span />}
        <span className={styles.lastRun}>{series.lastRun ? series.lastRun.note : "Not run yet"}</span>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {open && <RecurrenceDialog series={series} onClose={() => setOpen(false)} />}
    </article>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="15.5" cy="15.5" r="2.5" />
    </svg>
  );
}

const twelve = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const longDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** Same wording as describeRecurrence on the server, live while editing. */
function preview(r: Recurrence): string {
  const days = [...r.days].sort();
  if (!days.length || !r.times.length || !r.start) return "Pick a start date, at least one day and one time.";
  const which = days.length === 7 ? "day" : days.join() === "1,2,3,4,5" ? "weekday" : days.join() === "0,6" ? "Saturday and Sunday" : listOf(days.map((d) => DAY_NAMES[d]));
  const every = r.everyWeeks > 1 ? `every ${r.everyWeeks} weeks on ${days.length === 7 ? "every day" : which}` : `every ${which}`;
  return `Occurs ${every} at ${listOf([...r.times].sort().map(twelve))} starting ${longDay(r.start)}${r.end ? ` until ${longDay(r.end)}` : ""}.${r.holdHours ? ` Each video waits ${r.holdHours} h before it goes.` : ""}`;
}

function RecurrenceDialog({ series, onClose }: { series: Series; onClose: () => void }) {
  const [r, setR] = useState<Recurrence>(series.recurrence);
  const [ends, setEnds] = useState(series.recurrence.end ? "on" : "never");
  const { busy, error, run } = useAction();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const set = (patch: Partial<Recurrence>) => setR({ ...r, ...patch });
  const toggleDay = (d: number) => set({ days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort() });
  const save = () =>
    run(async () => {
      await call(`/api/admin/studio/series/${series.id}`, jsonInit("PUT", { recurrence: { ...r, end: ends === "on" ? r.end ?? r.start : "" } }));
      onClose();
    });
  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby={`rec-${series.id}`}>
      <div className={styles.dialogHead}>
        <h2 id={`rec-${series.id}`}>{series.name}</h2>
        <button type="button" className={styles.linkButton} aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div className={styles.formGrid}>
        <span>Start</span>
        <input className={styles.input} type="date" value={r.start} onChange={(e) => set({ start: e.target.value })} />
        <span>Repeat</span>
        <span>Weekly</span>
        <span>Every</span>
        <span className={styles.inline}>
          <input className={styles.input} type="number" min={1} max={8} value={r.everyWeeks} onChange={(e) => set({ everyWeeks: Number(e.target.value) })} style={{ width: 72 }} /> week(s)
        </span>
        <span>On</span>
        <span className={styles.dayPills}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button key={d} type="button" className={styles.dayPill} aria-pressed={r.days.includes(d)} aria-label={DAY_NAMES[d]} onClick={() => toggleDay(d)}>{DAY_LETTERS[d]}</button>
          ))}
        </span>
        <span style={{ alignSelf: "start", paddingTop: 8 }}>Times</span>
        <span style={{ display: "grid", gap: 6 }}>
          {r.times.map((t, i) => (
            <span key={i} className={styles.inline}>
              <input className={styles.input} type="time" step={3600} value={t} onChange={(e) => set({ times: r.times.map((x, j) => (j === i ? e.target.value : x)) })} />
              {i === 0 && <span className="notice">Chicago</span>}
              {r.times.length > 1 && <button type="button" className={styles.linkButton} aria-label={`Remove ${t}`} onClick={() => set({ times: r.times.filter((_, j) => j !== i) })}>Remove</button>}
            </span>
          ))}
          {r.times.length < 10 && <button type="button" className={styles.linkButton} onClick={() => set({ times: [...r.times, "12:00"] })}>+ another time that day</button>}
        </span>
        <span>End</span>
        <span className={styles.inline}>
          <select className={styles.input} value={ends} onChange={(e) => setEnds(e.target.value)}>
            <option value="never">never</option>
            <option value="on">on a date</option>
          </select>
          {ends === "on" && <input className={styles.input} type="date" value={r.end ?? r.start} onChange={(e) => set({ end: e.target.value })} />}
        </span>
        <span>Hold</span>
        <span className={styles.inline}>
          <input className={styles.input} type="number" min={0} max={168} value={r.holdHours} onChange={(e) => set({ holdHours: Number(e.target.value) })} style={{ width: 72 }} /> hours to stop a video before it goes
        </span>
      </div>
      <p className={styles.summary}>{preview({ ...r, end: ends === "on" ? r.end ?? r.start : undefined })}</p>
      <p className="notice">The site posts on the hour, so times are rounded to the hour they fall in.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className={styles.dialogActions}>
        <button type="button" className="button small secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="button small" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </dialog>
  );
}

/* ---------- where a video goes ---------- */

export interface PlaceRow {
  platform: Platform;
  name: string;
  state: string;
  live: boolean;
  url?: string;
  /** Can still be picked (not already live there). */
  pickable: boolean;
}

export function PlacesForm({ id, rows, picked, canPost, mode }: { id: string; rows: PlaceRow[]; picked: Platform[]; canPost: boolean; mode: string }) {
  const [sel, setSel] = useState<Platform[]>(picked);
  const { busy, error, done, run } = useAction();
  const flip = (p: Platform) => setSel(sel.includes(p) ? sel.filter((x) => x !== p) : [...sel, p]);
  const savePlaces = () => run(async () => { await call(`/api/admin/studio/videos/${id}/places`, jsonInit("PUT", { platforms: sel })); return "Saved. It takes the next open slot in each place."; });
  const postNow = () => {
    const where = rows.filter((r) => sel.includes(r.platform) && r.pickable).map((r) => r.name).join(" and ");
    if (!window.confirm(mode === "off" ? `Publishing is off, so this only logs a post to ${where}. Go ahead?` : `Post this to ${where} now${mode === "private" ? " (YouTube as private)" : ", publicly"}?`)) return;
    void run(async () => { await call(`/api/admin/studio/videos/${id}/post`, jsonInit("POST", { platforms: sel })); return mode === "off" ? "Logged. Nothing left the site." : "Posted."; });
  };
  return (
    <>
      <ul className={styles.places}>
        {rows.map((r) => (
          <li key={r.platform}>
            {r.live ? (
              <span className={styles.inline} style={{ flex: 1 }}>
                <span className={`${styles.dot} ${styles.small} ${styles.done}`} style={{ width: 20, height: 20 }} aria-hidden="true" />
                <span><span className={styles.placeName}>{r.name}</span><span className={styles.placeState}>{r.state}</span></span>
              </span>
            ) : (
              <label>
                <input type="checkbox" checked={sel.includes(r.platform)} disabled={!canPost || busy} onChange={() => flip(r.platform)} />
                <span><span className={styles.placeName}>{r.name}</span><span className={styles.placeState}>{r.state}</span></span>
              </label>
            )}
            {r.url && <a href={r.url} target="_blank" rel="noreferrer">Open ↗</a>}
          </li>
        ))}
      </ul>
      {canPost && (
        <p className={styles.inline}>
          <button type="button" className="button small secondary" disabled={busy} onClick={() => void savePlaces()}>Save where it goes</button>
          <button type="button" className="button small" disabled={busy || !rows.some((r) => r.pickable && sel.includes(r.platform))} onClick={postNow}>Post now</button>
        </p>
      )}
      <Status error={error} done={done} />
    </>
  );
}
