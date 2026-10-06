"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export const COST_LINES = ["venue", "mail", "ads", "refreshments", "materials", "other"] as const;

export interface SeminarFormValues {
  id?: string;
  code: string;
  title: string;
  format: "in_person" | "webinar" | "library_talk";
  heldOn: string;
  venue?: string;
  costs: Record<string, number>;
  mailPieces?: number;
  rsvps: number;
  attendees: number;
}

const dollars = (c?: number) => (c ? String(c / 100) : "");
const toCents = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? "").replace(/[$,]/g, "") || 0) * 100);
const toInt = (v: FormDataEntryValue | null) => Math.max(0, Math.floor(Number(v || 0)));

/** Create a new event, or (with `initial.id`) update costs and counts after it runs. */
export function SeminarForm({ initial }: { initial?: SeminarFormValues }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = !!initial?.id;

  const submit = async (form: FormData) => {
    setBusy(true);
    setError(null);
    const costs: Record<string, number> = {};
    for (const k of COST_LINES) {
      const c = toCents(form.get(`cost_${k}`));
      if (c > 0) costs[k] = c;
    }
    const body = {
      ...(editing ? {} : { code: String(form.get("code") ?? "") }),
      title: String(form.get("title") ?? ""),
      format: String(form.get("format") ?? "in_person"),
      heldOn: String(form.get("heldOn") ?? ""),
      venue: String(form.get("venue") ?? "") || undefined,
      costs,
      mailPieces: form.get("mailPieces") ? toInt(form.get("mailPieces")) : undefined,
      rsvps: toInt(form.get("rsvps")),
      attendees: toInt(form.get("attendees")),
    };
    try {
      const res = await fetch(editing ? `/api/admin/seminars/${initial!.id}` : "/api/admin/seminars", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form action={(f) => void submit(f)} className="card">
      {!editing && (
        <label className="field">Code (use as utm_campaign on invitations)<input name="code" required pattern="[a-z0-9][a-z0-9-]{1,48}" placeholder="trusts101-oct" /></label>
      )}
      <label className="field">Title<input name="title" required defaultValue={initial?.title} /></label>
      <label className="field">Format
        <select name="format" defaultValue={initial?.format ?? "in_person"}>
          <option value="in_person">In person</option>
          <option value="webinar">Webinar</option>
          <option value="library_talk">Library or community talk</option>
        </select>
      </label>
      <label className="field">Date<input name="heldOn" type="date" required defaultValue={initial?.heldOn} /></label>
      <label className="field">Venue<input name="venue" defaultValue={initial?.venue} /></label>
      <fieldset>
        <legend>Costs (dollars)</legend>
        {COST_LINES.map((k) => (
          <label key={k} className="field">{k}<input name={`cost_${k}`} inputMode="decimal" defaultValue={dollars(initial?.costs[k])} /></label>
        ))}
      </fieldset>
      <label className="field">Mail pieces sent<input name="mailPieces" type="number" min={0} defaultValue={initial?.mailPieces} /></label>
      <label className="field">RSVPs<input name="rsvps" type="number" min={0} defaultValue={initial?.rsvps ?? 0} /></label>
      <label className="field">Attended<input name="attendees" type="number" min={0} defaultValue={initial?.attendees ?? 0} /></label>
      <button className="button" disabled={busy}>{editing ? "Save counts and costs" : "Add event"}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
