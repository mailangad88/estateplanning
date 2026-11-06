"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { fillTemplate, MERGE_FIELDS, SAMPLE_VALUES, STARTER_TEMPLATE, type MergeValues } from "@/lib/retainerTemplates";
import type { EngagementAttachment, RetainerTemplate } from "@/server/types";
import type { TemplateSummary } from "@/server/services/retainerTemplates";
import { LetterPreview } from "./LetterPreview";
import styles from "./retainers.module.css";

interface Props {
  templates: TemplateSummary[];
  matters: { key: string; label: string }[];
  canManage: boolean;
  canApprove: boolean;
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json;
}

const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" }) : "");

/** A sample lead that is missing the address and organizer, to show how missing fields are flagged. */
const INCOMPLETE: MergeValues = { ...SAMPLE_VALUES, client_address: undefined, organizer_summary: undefined };

function TemplateCard({ t, matters, canManage, canApprove, onEdit }: { t: TemplateSummary; matters: Props["matters"]; canManage: boolean; canApprove: boolean; onEdit: (t: RetainerTemplate) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
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
  const latest = t.latest;
  const inUse = t.approved;
  const label = (k: string) => matters.find((m) => m.key === k)?.label ?? k;
  return (
    <li className={styles.tcard}>
      <h3>{t.name}</h3>
      <div className={styles.meta}>
        {latest.matterTypes.map(label).join(" · ")}
      </div>
      <div className={styles.row}>
        <span className={`${styles.pill} ${styles[`p_${latest.status}`]}`}>v{latest.version} {latest.status === "draft" ? "waiting for approval" : latest.status}</span>
        {latest.pdf && <a className={styles.meta} href={`/api/portal/retainers/${encodeURIComponent(latest.id)}/pdf`} target="_blank" rel="noopener">PDF: {latest.pdf.name}</a>}
      </div>
      {inUse ? (
        <p className={styles.meta}>In use: v{inUse.version}, approved by {inUse.approvedByName} on {when(inUse.approvedAt)}.</p>
      ) : (
        <p className={styles.meta}>Not in use yet: an attorney of the firm must approve it.</p>
      )}
      {inUse && canManage && (
        <div className={styles.defaults} aria-label="Default for">
          {inUse.matterTypes.map((m) => (
            <label key={m}>
              <input type="checkbox" checked={inUse.defaultFor.includes(m)} disabled={busy} onChange={(e) => run(() => post(`/api/portal/retainers/${encodeURIComponent(inUse.id)}/default`, { matterType: m, on: e.target.checked }))} />
              Default for {label(m)}
            </label>
          ))}
        </div>
      )}
      {latest.status === "draft" && canApprove && (
        <div className={styles.approve}>
          <label>
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>I have read version {latest.version} and approve its wording for my firm&apos;s clients.</span>
          </label>
          <button className="button small" disabled={!confirm || busy} onClick={() => run(() => post(`/api/portal/retainers/${encodeURIComponent(latest.id)}/approve`))}>Approved by me</button>
        </div>
      )}
      <div className={styles.row}>
        {canManage && <button className="button secondary small" onClick={() => onEdit(latest)}>Edit (new version)</button>}
        {canManage && (latest.status === "draft" || latest.status === "approved") && (
          <button className="linklike" disabled={busy} onClick={() => run(() => post(`/api/portal/retainers/${encodeURIComponent(latest.id)}/retire`))}>Retire</button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </li>
  );
}

export function RetainerEditor({ templates, matters, canManage, canApprove }: Props) {
  const router = useRouter();
  const area = useRef<HTMLTextAreaElement>(null);
  const [templateKey, setTemplateKey] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>(["new_plan"]);
  const [body, setBody] = useState(STARTER_TEMPLATE);
  const [pdf, setPdf] = useState<EngagementAttachment | null | undefined>(undefined);
  const [currentPdf, setCurrentPdf] = useState<EngagementAttachment | undefined>();
  const [incomplete, setIncomplete] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const filled = useMemo(() => fillTemplate(body, incomplete ? INCOMPLETE : SAMPLE_VALUES), [body, incomplete]);
  const shownPdf = pdf === null ? undefined : (pdf ?? currentPdf);

  const insert = (key: string) => {
    const el = area.current;
    const token = `{{${key}}}`;
    if (!el) return setBody((b) => b + token);
    const { selectionStart: s, selectionEnd: e } = el;
    const next = body.slice(0, s) + token + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  };

  const edit = (t: RetainerTemplate) => {
    setTemplateKey(t.templateKey);
    setName(t.name);
    setPicked(t.matterTypes);
    setBody(t.body);
    setPdf(undefined);
    setCurrentPdf(t.pdf);
    setSaved(null);
    area.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const reset = () => {
    setTemplateKey(undefined);
    setName("");
    setPicked(["new_plan"]);
    setBody(STARTER_TEMPLATE);
    setPdf(undefined);
    setCurrentPdf(undefined);
  };

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/portal/retainers/pdf", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setPdf(json as EngagementAttachment);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await post("/api/portal/retainers", { templateKey, name, matterTypes: picked, body, pdf })) as { version: number };
      setSaved(`Saved as version ${r.version}. ${canApprove ? "Approve it in the list above to start using it." : "An attorney of the firm needs to approve it before it is used."}`);
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>Your templates</h2>
      {templates.length === 0 ? <p>No templates yet. Until you add and approve one, retainers use the platform&apos;s draft letter.</p> : (
        <ul className={styles.list}>
          {templates.map((t) => <TemplateCard key={t.templateKey} t={t} matters={matters} canManage={canManage} canApprove={canApprove} onEdit={edit} />)}
        </ul>
      )}
      {saved && <p className="callout" role="status">{saved}</p>}

      {canManage && (
        <div className={styles.editor}>
          <form className={styles.panel} onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <h2>{templateKey ? `New version of “${name}”` : "New template"}</h2>
            <label className={styles.field}>
              Name
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Estate plan flat-fee agreement" required />
            </label>
            <fieldset className={styles.field} style={{ border: 0, padding: 0 }}>
              <legend>Use for these matters</legend>
              <div className={styles.matters}>
                {matters.map((m) => (
                  <label key={m.key}>
                    <input type="checkbox" checked={picked.includes(m.key)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.key] : p.filter((x) => x !== m.key)))} />
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <span className={styles.field}>Insert a field where the cursor is</span>
            <div className={styles.chips}>
              {MERGE_FIELDS.map((f) => <button key={f.key} type="button" className={styles.chip} onClick={() => insert(f.key)}>{f.label}</button>)}
            </div>
            <label className={styles.field}>
              Agreement text
              <textarea ref={area} value={body} onChange={(e) => setBody(e.target.value)} spellCheck />
            </label>
            <div className={styles.pdfBox}>
              <strong>Your standard agreement (optional PDF)</strong>
              <p className={styles.meta}>Shown to the client in full and signed together with the text above. Up to 5 MB.</p>
              {shownPdf ? (
                <p>Attached: {shownPdf.name} <button type="button" className="linklike" onClick={() => setPdf(null)}>Remove</button></p>
              ) : (
                <input type="file" accept="application/pdf" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
              )}
            </div>
            {filled.unknown.length > 0 && <p className="error">Not merge fields (check the spelling): {filled.unknown.map((u) => `{{${u}}}`).join(", ")}</p>}
            <div className={styles.row}>
              <button className="button" type="submit" disabled={busy || !name.trim() || picked.length === 0}>{templateKey ? "Save new version" : "Save template"}</button>
              {templateKey && <button type="button" className="linklike" onClick={reset}>Cancel</button>}
            </div>
            {error && <p className="error">{error}</p>}
            <p className={styles.meta}>Saving creates a draft. It is used only after an attorney of your firm approves that exact version.</p>
          </form>

          <section className={styles.panel} aria-labelledby="preview-h">
            <h2 id="preview-h">Live preview with a sample client</h2>
            <label className={styles.toggle}>
              <input type="checkbox" checked={incomplete} onChange={(e) => setIncomplete(e.target.checked)} />
              Show what happens when a lead is missing details
            </label>
            <LetterPreview segments={filled.segments} />
            <p className={styles.meta}>
              <mark className={styles.filled}>Green</mark> fills in from what the client told us. <mark className={styles.missing}>Missing</mark> fields are asked of the lawyer before sending.
              {shownPdf ? ` The PDF “${shownPdf.name}” follows the text.` : ""}
            </p>
          </section>
        </div>
      )}
    </>
  );
}
