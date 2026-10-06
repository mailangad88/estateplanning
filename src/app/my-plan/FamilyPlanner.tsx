"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import LeadForm from "@/components/LeadForm";
import { track } from "@/components/capture";
import { US_STATES } from "@/config/firm";
import { PLAN_DOCS } from "@/config/what-if-scenarios";
import {
  ASSET_TYPE_LABELS,
  ASSET_TYPES,
  BENEFICIARY_TYPES,
  CHILDREN_LABELS,
  CHILDREN_STATUSES,
  DOC_KEYS,
  DOC_LABELS,
  FAMILY_PLAN_CONSENT_TEXT,
  FAMILY_PLAN_CONSENT_VERSION,
  FAMILY_PLAN_DISCLAIMER,
  MARITAL_LABELS,
  MARITAL_STATUSES,
  SECTION_KEYS,
  SECTION_LABELS,
  TITLING_LABELS,
  TITLINGS,
  VALUE_RANGE_LABELS,
  VALUE_RANGES,
  WISH_KEYS,
  WISH_LABELS,
  YES_NO_UNSURE,
  YES_NO_UNSURE_LABELS,
  answersFromPlan,
  emptyPlan,
  formatTotal,
  isMinor,
  mergePlans,
  organizerSignals,
  prefillPlan,
  validatePlan,
  type AssetType,
  type DocKey,
  type FamilyPlanBody,
  type FamilyPlanSummary,
  type SectionStatus,
} from "@/lib/familyPlan";
import { clearDraft, loadDraft, saveDraft, takeHandoff } from "@/lib/familyPlanHandoff";
import { loadVisitor } from "@/lib/visitor";
import type { OwnPlan } from "@/server/services/familyPlan";
import styles from "./FamilyPlanner.module.css";

type SaveState = "idle" | "pending" | "saving" | "saved" | "device" | "error";
type Errors = Record<string, string>;

const rid = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;
const thisYear = new Date().getFullYear();

const SOURCE_LABELS: Record<string, string> = {
  plan_finder: "the plan finder",
  life_game: "the life game",
  contact: "the contact details you gave us",
  lead: "the answers you gave when you asked for a consult",
};

const STATUS_LABEL: Record<SectionStatus, string> = { empty: "Not started", started: "Started", done: "Done" };

interface Props {
  initial: OwnPlan | null;
  configured: boolean;
  saved?: "new" | "back";
  linkExpired: boolean;
  phone: string;
}

export default function FamilyPlanner({ initial, configured, saved, linkExpired, phone }: Props) {
  const [signedIn, setSignedIn] = useState(!!initial);
  const [body, setBody] = useState<FamilyPlanBody>(() => initial?.body ?? emptyPlan());
  const [summary, setSummary] = useState<FamilyPlanSummary | null>(initial?.summary ?? null);
  const [linked, setLinked] = useState(!!initial?.linkedToLead);
  const [errors, setErrors] = useState<Errors>({});
  const [saveState, setSaveState] = useState<SaveState>(initial ? "saved" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const [prefillShown, setPrefillShown] = useState(false);
  const [ready, setReady] = useState(false);
  const dirty = useRef(false);

  // First visit: pick up the device draft, or start from what the visitor told us earlier.
  useEffect(() => {
    const handoff = takeHandoff();
    const visitorState = loadVisitor()?.contact.state;
    const prefill = prefillPlan({ answers: handoff?.answers, state: handoff?.state ?? visitorState, lifeGameDocs: handoff?.lifeGameDocs });
    const draft = loadDraft();
    const parsed = draft ? validatePlan(draft) : null;
    if (initial) {
      // Signed in: anything still on this device fills sections the saved plan has not started, then leaves the device.
      let next = initial.body;
      if (parsed?.ok) next = mergePlans(next, parsed.body);
      if (prefill) next = mergePlans(next, prefill);
      clearDraft();
      if (JSON.stringify(next) !== JSON.stringify(initial.body)) {
        dirty.current = true;
        setBody(next);
        setSaveState("pending");
      }
      setPrefillShown(!!next.prefill?.sources.length);
    } else if (parsed?.ok) {
      dirty.current = true;
      setBody(parsed.body);
      setPrefillShown(!!parsed.body.prefill?.sources.length);
    } else if (prefill) {
      dirty.current = true;
      setBody(prefill);
      setPrefillShown(true);
    } else {
      // Nothing to show yet; ask the server for the empty plan's progress so the meter is real.
      dirty.current = true;
    }
    setReady(true);
  }, []);

  // Save as you go: to the server when signed in, otherwise to this device only.
  useEffect(() => {
    if (!ready || !dirty.current) return;
    const t = setTimeout(() => void persist(body), 900);
    return () => clearTimeout(t);
  }, [body, ready, signedIn]);

  async function persist(b: FamilyPlanBody) {
    dirty.current = false;
    const local = validatePlan(b);
    if (!local.ok) {
      // Never keep text that looks like an account number or SSN, not even on this device.
      setErrors(local.fields);
      setSaveState("error");
      setMessage(local.error);
      return;
    }
    setSaveState("saving");
    try {
      if (signedIn) {
        const res = await fetch("/api/my-plan", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: b }) });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 404) {
          setSignedIn(false);
          saveDraft(b);
          setSaveState("device");
          setMessage("Your sign-in has ended, so your changes are kept on this device. Ask for a new link below to save them.");
          return;
        }
        if (!res.ok) {
          setErrors(data.fields ?? {});
          setSaveState("error");
          setMessage(data.error ?? "We could not save that. Please try again.");
          return;
        }
        setSummary(data.plan.summary);
        setLinked(!!data.plan.linkedToLead);
        setErrors({});
        setMessage(null);
        setSaveState("saved");
      } else {
        saveDraft(b);
        const res = await fetch("/api/my-plan/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: b }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrors(data.fields ?? {});
          setSaveState("error");
          setMessage(data.error ?? "Some answers need another look.");
          return;
        }
        setSummary(data.summary);
        setErrors({});
        setMessage(null);
        setSaveState("device");
      }
    } catch {
      if (!signedIn) saveDraft(b);
      setSaveState("error");
      setMessage("We could not reach the server. Your answers are still on this page; we will try again when you make the next change.");
    }
  }

  function update(fn: (draft: FamilyPlanBody) => void) {
    setBody((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    dirty.current = true;
    setSaveState("pending");
  }

  function startBlank() {
    dirty.current = true;
    setBody(emptyPlan());
    setPrefillShown(false);
    setSaveState("pending");
  }

  const err = (path: string) => errors[path];
  const done = summary?.sectionsDone ?? 0;
  const total = summary?.sectionsTotal ?? SECTION_KEYS.length;
  const sections = summary?.sections;
  const gaps = summary?.gaps ?? [];
  const assetLabel = (id: string) => body.assets.items.find((a) => a.id === id)?.label || "Unnamed";
  const interests = (body.prefill?.interests ?? []).map((k) => (PLAN_DOCS as Record<string, { label: string }>)[k]?.label).filter(Boolean);

  return (
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Your organizer</p>
        <h1>My family plan</h1>
        <p className="lead">
          One place for the people you count on, what you own and the papers you already have. Fill in what you know,
          skip what you don&apos;t. It saves as you go.
        </p>
      </header>

      <aside className={styles.never} aria-label="What this organizer never stores">
        <strong>What we never ask for or keep</strong>
        <p>
          Account numbers, Social Security numbers, card numbers, passwords, PINs or full dates of birth. A nickname like
          &ldquo;Chase checking&rdquo; and a birth year are all this needs. If something looks like one of those, we will not save it.
        </p>
      </aside>

      {linkExpired && <p className={styles.alert} role="alert">That link has expired or was already used. Ask for a new one in &ldquo;Save your plan&rdquo; below.</p>}
      {saved && signedIn && (
        <p className={styles.ok} role="status">{saved === "new" ? "Your plan is saved. You can come back to it any time from the link we emailed." : "Welcome back. Here is your plan where you left it."}</p>
      )}

      {prefillShown && body.prefill?.sources.length ? (
        <div className={styles.prefill} role="status">
          <p>
            <strong>We filled in what you told us earlier</strong> in {body.prefill.sources.map((s) => SOURCE_LABELS[s] ?? s).join(" and ")}. Check it
            and change anything that isn&apos;t right.
          </p>
          {interests.length > 0 && <p>In the life game you chose to plan for: {interests.join(", ")}.</p>}
          <button type="button" className="linklike" onClick={startBlank}>Start blank instead</button>
        </div>
      ) : null}

      {/* Progress and gaps */}
      <section className={styles.card} aria-labelledby="fp-progress">
        <div className={styles.progressHead}>
          <h2 id="fp-progress">{done} of {total} sections done</h2>
          <SaveStatus state={saveState} signedIn={signedIn} />
        </div>
        <div className={styles.meter} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Sections done">
          <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
        <ol className={styles.steps}>
          {SECTION_KEYS.map((k) => (
            <li key={k}>
              <a href={`#fp-${k}`}>{SECTION_LABELS[k]}</a>
              <span className={`${styles.chip} ${sections?.[k] === "done" ? styles.chipDone : sections?.[k] === "started" ? styles.chipStarted : ""}`}>
                {STATUS_LABEL[sections?.[k] ?? "empty"]}
              </span>
            </li>
          ))}
        </ol>
        {message && <p className="error" role="alert">{message}</p>}

        <h3 className={styles.gapsTitle}>Things to talk through</h3>
        {gaps.length === 0 ? (
          <p className="notice">
            {summary && summary.sections.people !== "empty" ? "Nothing stands out from what you have entered so far." : "As you fill in your plan, anything worth a closer look shows up here."}
          </p>
        ) : (
          <ul className={styles.gaps}>
            {gaps.map((g) => (
              <li key={g.code}>
                <span>{g.text}</span>
                {g.assetIds && g.assetIds.length > 0 && <span className={styles.gapAssets}>{g.assetIds.map(assetLabel).join(", ")}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="notice">{FAMILY_PLAN_DISCLAIMER} These prompts come only from what you entered.</p>
      </section>

      {/* 1. People */}
      <Section k="people" n={1} status={sections?.people} open>
        <p className="notice">Names only. Spell them the way you would on a form.</p>
        <div className={styles.grid}>
          <Select label="State you live in" value={body.people.homeState} options={US_STATES.map((s) => [s, s])} error={err("people.homeState")}
            onChange={(v) => update((d) => { d.people.homeState = v as FamilyPlanBody["people"]["homeState"]; })} />
          <Select label="Relationship status" value={body.people.maritalStatus} options={MARITAL_STATUSES.map((s) => [s, MARITAL_LABELS[s]])}
            onChange={(v) => update((d) => { d.people.maritalStatus = v as FamilyPlanBody["people"]["maritalStatus"]; })} />
          {(body.people.maritalStatus === "married" || body.people.maritalStatus === "partnered") && (
            <>
              <Text label="Spouse or partner's name" value={body.people.spouseName} error={err("people.spouseName")} onChange={(v) => update((d) => { d.people.spouseName = v; })} />
              {body.people.maritalStatus === "married" && (
                <Year label="Year you married" value={body.people.marriageYear} error={err("people.marriageYear")} onChange={(v) => update((d) => { d.people.marriageYear = v; })} />
              )}
            </>
          )}
          <Select label="Children" value={body.people.childrenStatus} options={CHILDREN_STATUSES.map((s) => [s, CHILDREN_LABELS[s]])}
            onChange={(v) => update((d) => { d.people.childrenStatus = v as FamilyPlanBody["people"]["childrenStatus"]; if (v === "none") d.people.children = []; })} />
        </div>

        {body.people.childrenStatus && body.people.childrenStatus !== "none" && (
          <fieldset className={styles.group}>
            <legend>Your children</legend>
            <p className="notice">First name and birth year are enough.</p>
            {body.people.children.map((c, i) => (
              <div key={c.id} className={styles.item}>
                <div className={styles.grid}>
                  <Text label={`Child ${i + 1} name`} value={c.name} error={err(`people.children.${i}.name`)} onChange={(v) => update((d) => { d.people.children[i].name = v ?? ""; })} />
                  <Year label="Birth year" value={c.birthYear} error={err(`people.children.${i}.birthYear`)} onChange={(v) => update((d) => { d.people.children[i].birthYear = v; })} />
                </div>
                {c.birthYear === undefined && (
                  <label className={styles.check}>
                    <input type="checkbox" checked={c.minor === true} onChange={(e) => update((d) => { d.people.children[i].minor = e.target.checked; })} /> Under 18
                  </label>
                )}
                {c.birthYear !== undefined && <p className="notice">{isMinor(c, thisYear) ? "Under 18" : "Adult"}</p>}
                <button type="button" className={styles.remove} onClick={() => update((d) => { d.people.children.splice(i, 1); })}>Remove</button>
              </div>
            ))}
            <button type="button" className="button secondary small" onClick={() => update((d) => { d.people.children.push({ id: rid("c-"), name: "" }); })}>Add a child</button>
          </fieldset>
        )}

        {(summary?.household.minors ?? 0) > 0 || body.people.childrenStatus === "minors" || body.people.childrenStatus === "both" || body.people.children.some((c) => isMinor(c, thisYear)) ? (
          <fieldset className={styles.group}>
            <legend>Guardians for your minor children</legend>
            <p className="notice">The person who would raise your children if you could not, and a backup.</p>
            <div className={styles.grid}>
              <Text label="First choice" value={body.people.guardian} error={err("people.guardian")} onChange={(v) => update((d) => { d.people.guardian = v; })} />
              <Text label="Backup" value={body.people.backupGuardian} error={err("people.backupGuardian")} onChange={(v) => update((d) => { d.people.backupGuardian = v; })} />
            </div>
          </fieldset>
        ) : null}

        <fieldset className={styles.group}>
          <legend>People you would trust to act for you</legend>
          <div className={styles.grid}>
            <Text label="Executor or trustee" hint="Settles your estate and follows your instructions." value={body.people.executor} error={err("people.executor")} onChange={(v) => update((d) => { d.people.executor = v; })} />
            <Text label="Financial agent" hint="Handles money and bills if you cannot." value={body.people.financialAgent} error={err("people.financialAgent")} onChange={(v) => update((d) => { d.people.financialAgent = v; })} />
            <Text label="Healthcare agent" hint="Speaks with doctors for you if you cannot." value={body.people.healthcareAgent} error={err("people.healthcareAgent")} onChange={(v) => update((d) => { d.people.healthcareAgent = v; })} />
          </div>
        </fieldset>
      </Section>

      {/* 2. Assets */}
      <Section k="assets" n={2} status={sections?.assets} open>
        <p className={styles.neverInline}>
          <strong>No account numbers, please.</strong> A nickname is enough: &ldquo;Chase checking&rdquo;, &ldquo;Work 401(k)&rdquo;. Ranges are fine; nobody needs the exact figure.
        </p>
        {body.assets.items.length === 0 && <p className="notice">Nothing listed yet. Add what you own, one thing at a time.</p>}
        {body.assets.items.map((a, i) => (
          <div key={a.id} className={styles.item}>
            <div className={styles.grid}>
              <Select label="Type" value={a.type} options={ASSET_TYPES.map((t) => [t, ASSET_TYPE_LABELS[t]])} required
                onChange={(v) => update((d) => { d.assets.items[i].type = (v ?? "other") as AssetType; })} />
              <Text label="What you call it" placeholder="e.g. Chase checking" value={a.label} error={err(`assets.items.${i}.label`)} onChange={(v) => update((d) => { d.assets.items[i].label = v ?? ""; })} />
              <Select label="Rough value" value={a.valueRange} options={VALUE_RANGES.map((r) => [r, VALUE_RANGE_LABELS[r]])}
                onChange={(v) => update((d) => { d.assets.items[i].valueRange = v as (typeof VALUE_RANGES)[number]; })} />
              <Select label="How it is titled" value={a.titling} options={TITLINGS.map((t) => [t, TITLING_LABELS[t]])}
                onChange={(v) => update((d) => { d.assets.items[i].titling = v as (typeof TITLINGS)[number]; })} />
              {BENEFICIARY_TYPES.includes(a.type) && (
                <>
                  <Select label={a.type === "real_estate" || a.type === "vehicle" ? "Transfer-on-death beneficiary named?" : "Beneficiary named?"} value={a.beneficiary}
                    options={YES_NO_UNSURE.map((y) => [y, YES_NO_UNSURE_LABELS[y]])}
                    onChange={(v) => update((d) => { d.assets.items[i].beneficiary = v as (typeof YES_NO_UNSURE)[number]; })} />
                  {a.beneficiary === "yes" && (
                    <Text label="Who" value={a.beneficiaryName} error={err(`assets.items.${i}.beneficiaryName`)} onChange={(v) => update((d) => { d.assets.items[i].beneficiaryName = v; })} />
                  )}
                </>
              )}
            </div>
            <button type="button" className={styles.remove} onClick={() => update((d) => { d.assets.items.splice(i, 1); })}>Remove</button>
          </div>
        ))}
        <AddAsset onAdd={(type) => update((d) => { d.assets.items.push({ id: rid("a-"), type, label: "" }); })} />
        {summary && summary.assets.count > 0 && (
          <p className={styles.total}>
            Rough total: <strong>{formatTotal(summary.assets.totalLow, summary.assets.totalHigh)}</strong>
            {summary.assets.unvalued > 0 && ` (plus ${summary.assets.unvalued} not estimated)`}
          </p>
        )}
      </Section>

      {/* 3. Documents */}
      <Section k="documents" n={3} status={sections?.documents}>
        <p className="notice">Documents you have already signed, anywhere.</p>
        {DOC_KEYS.map((k: DocKey) => {
          const doc = body.documents[k] ?? {};
          return (
            <div key={k} className={styles.item}>
              <div className={styles.grid}>
                <Select label={k === "beneficiaryForms" ? "Have you reviewed your beneficiary forms?" : `${DOC_LABELS[k]}: do you have one?`} value={doc.has}
                  options={YES_NO_UNSURE.map((y) => [y, YES_NO_UNSURE_LABELS[y]])}
                  onChange={(v) => update((d) => { d.documents[k] = { ...d.documents[k], has: v as (typeof YES_NO_UNSURE)[number] }; })} />
                {doc.has === "yes" && (
                  <>
                    <Year label={k === "beneficiaryForms" ? "Year last reviewed" : "Year signed"} value={doc.yearSigned} error={err(`documents.${k}.yearSigned`)}
                      onChange={(v) => update((d) => { d.documents[k] = { ...d.documents[k], yearSigned: v }; })} />
                    {k !== "beneficiaryForms" && (
                      <Select label="State where signed" value={doc.state} options={US_STATES.map((s) => [s, s])}
                        onChange={(v) => update((d) => { d.documents[k] = { ...d.documents[k], state: v as FamilyPlanBody["people"]["homeState"] }; })} />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </Section>

      {/* 4. Wishes */}
      <Section k="wishes" n={4} status={sections?.wishes}>
        <p className="notice">A sentence or two each. These are notes for you and your attorney, not legal documents.</p>
        {WISH_KEYS.map((k) => (
          <Area key={k} label={WISH_LABELS[k]} value={body.wishes[k]} error={err(`wishes.${k}`)} onChange={(v) => update((d) => { d.wishes[k] = v; })} />
        ))}
      </Section>

      {/* 5. Papers */}
      <Section k="papers" n={5} status={sections?.papers}>
        <p className="notice">Where would your family look? For example: &ldquo;fireproof box in the hall closet&rdquo;. Do not write down combinations or passwords.</p>
        <Area label="Where key papers are kept" value={body.papers.location} error={err("papers.location")} onChange={(v) => update((d) => { d.papers.location = v; })} />
      </Section>

      <SavePanel
        configured={configured}
        signedIn={signedIn}
        onSignedOut={() => {
          // Leave nothing of the saved plan on the page or the device after signing out.
          dirty.current = false;
          setSignedIn(false);
          setBody(emptyPlan());
          setSummary(null);
          setPrefillShown(false);
          setSaveState("idle");
          setMessage("You are signed out on this device. Your saved plan is still there; ask for a new link to open it.");
        }}
        onDeleted={() => {
          clearDraft();
          setSignedIn(false);
          setBody(emptyPlan());
          setSummary(null);
          setErrors({});
          setPrefillShown(false);
          setSaveState("idle");
          setMessage(null);
          dirty.current = false;
        }}
        onClearDevice={() => {
          clearDraft();
          dirty.current = false;
          setBody(emptyPlan());
          setSummary(null);
          setPrefillShown(false);
          setSaveState("idle");
        }}
      />

      <ConsultCta body={body} summary={summary} signedIn={signedIn} linked={linked} phone={phone} onLinked={() => setLinked(true)} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function SaveStatus({ state, signedIn }: { state: SaveState; signedIn: boolean }) {
  const text: Record<SaveState, string> = {
    idle: signedIn ? "Saved" : "Not saved yet",
    pending: "Saving…",
    saving: "Saving…",
    saved: "Saved to your plan",
    device: "Saved on this device only",
    error: "Not saved",
  };
  return <p className={`${styles.saveStatus} ${state === "error" ? styles.saveError : ""}`} aria-live="polite">{text[state]}</p>;
}

function Section({ k, n, status = "empty", open, children }: { k: string; n: number; status?: SectionStatus; open?: boolean; children: React.ReactNode }) {
  return (
    <details className={styles.section} id={`fp-${k}`} open={open}>
      <summary>
        <span className={styles.sectionTitle}><span className={styles.num} aria-hidden="true">{n}</span>{SECTION_LABELS[k as keyof typeof SECTION_LABELS]}</span>
        <span className={`${styles.chip} ${status === "done" ? styles.chipDone : status === "started" ? styles.chipStarted : ""}`}>{STATUS_LABEL[status]}</span>
      </summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  );
}

function Hint({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return (
    <>
      {hint && <span id={`${id}-hint`} className={styles.hint}>{hint}</span>}
      {error && <span id={`${id}-err`} className="error" role="alert">{error}</span>}
    </>
  );
}

const describedBy = (id: string, hint?: string, error?: string) => [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;

function Text({ label, value, onChange, error, hint, placeholder }: { label: string; value?: string; onChange: (v: string | undefined) => void; error?: string; hint?: string; placeholder?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      {label}
      <input id={id} value={value ?? ""} maxLength={80} autoComplete="off" placeholder={placeholder}
        aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)} />
      <Hint id={id} hint={hint} error={error} />
    </label>
  );
}

function Area({ label, value, onChange, error }: { label: string; value?: string; onChange: (v: string | undefined) => void; error?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      {label}
      <textarea id={id} rows={3} maxLength={1000} value={value ?? ""} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, undefined, error)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)} />
      <Hint id={id} error={error} />
    </label>
  );
}

function Year({ label, value, onChange, error }: { label: string; value?: number; onChange: (v: number | undefined) => void; error?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      {label}
      <input id={id} type="number" inputMode="numeric" min={1900} max={thisYear} placeholder="YYYY" value={value ?? ""}
        aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, undefined, error)}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) && n >= 1900 && n <= 2100 ? n : undefined);
        }} />
      <Hint id={id} error={error} />
    </label>
  );
}

function Select({ label, value, options, onChange, error, required }: {
  label: string; value?: string; options: [string, string][]; onChange: (v: string | undefined) => void; error?: string; required?: boolean;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      {label}
      <select id={id} value={value ?? ""} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, undefined, error)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}>
        {!required && <option value="">Choose one</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Hint id={id} error={error} />
    </label>
  );
}

function AddAsset({ onAdd }: { onAdd: (type: AssetType) => void }) {
  const [type, setType] = useState<AssetType>("real_estate");
  const id = useId();
  return (
    <div className={styles.addRow}>
      <label htmlFor={id} className="sr-only">Type of thing to add</label>
      <select id={id} value={type} onChange={(e) => setType(e.target.value as AssetType)}>
        {ASSET_TYPES.map((t) => <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>)}
      </select>
      <button type="button" className="button secondary small" onClick={() => onAdd(type)}>Add</button>
    </div>
  );
}

function SavePanel({ configured, signedIn, onSignedOut, onDeleted, onClearDevice }: {
  configured: boolean; signedIn: boolean; onSignedOut: () => void; onDeleted: () => void; onClearDevice: () => void;
}) {
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agree) {
      setError("Please read and agree to how we store your plan.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/my-plan/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, consent: agree, consentVersion: FAMILY_PLAN_CONSENT_VERSION }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "We could not send the link. Please try again.");
      else {
        setSent(true);
        track("family_plan_link_requested");
      }
    } catch {
      setError("We could not send the link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/my-plan/logout", { method: "POST" }).catch(() => undefined);
    onSignedOut();
  }

  async function deleteAll() {
    setBusy(true);
    try {
      const res = await fetch("/api/my-plan", { method: "DELETE" });
      if (res.ok || res.status === 401) {
        setDeleted(true);
        setConfirmDelete(false);
        onDeleted();
      } else setError("We could not delete your plan. Please try again, or call us and we will do it for you.");
    } finally {
      setBusy(false);
    }
  }

  if (deleted) {
    return (
      <section className={styles.card} id="fp-save" aria-labelledby="fp-save-h">
        <h2 id="fp-save-h">Your plan is deleted</h2>
        <p role="status">We removed your answers and the summary for good, and cleared this device. You can start again any time.</p>
      </section>
    );
  }

  if (signedIn) {
    return (
      <section className={styles.card} id="fp-save" aria-labelledby="fp-save-h">
        <h2 id="fp-save-h">Your plan is saved</h2>
        <p>Changes save as you go. To come back on another device, ask for a new link with the same email.</p>
        <div className={styles.actions}>
          <button type="button" className="button secondary small" onClick={() => void signOut()}>Sign out on this device</button>
          {!confirmDelete ? (
            <button type="button" className={styles.danger} onClick={() => setConfirmDelete(true)}>Delete my data</button>
          ) : (
            <span className={styles.confirm} role="group" aria-label="Confirm delete">
              <span>This removes your whole plan for good. It cannot be undone.</span>
              <button type="button" className={styles.dangerSolid} disabled={busy} onClick={() => void deleteAll()}>Yes, delete everything</button>
              <button type="button" className="linklike" onClick={() => setConfirmDelete(false)}>Keep my plan</button>
            </span>
          )}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section className={styles.card} id="fp-save" aria-labelledby="fp-save-h">
      <h2 id="fp-save-h">Save your plan</h2>
      {!configured ? (
        <p>Saving is not available yet. Your answers stay on this device until you clear them.</p>
      ) : sent ? (
        <p role="status">Check your email. The link works once and expires in 30 minutes. Until you open it, your answers stay on this device only.</p>
      ) : (
        <form onSubmit={(e) => void requestLink(e)} noValidate>
          <p>Right now your answers are only on this device. Enter your email and we will send a link that saves them. No password needed.</p>
          <label className="field" htmlFor="fp-email">
            Email
            <input id="fp-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <div className={styles.consent}>
            <p><strong>Before you save</strong></p>
            <ul>{FAMILY_PLAN_CONSENT_TEXT.map((t) => <li key={t}>{t}</li>)}</ul>
            <label className={styles.check}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I have read this and want my plan saved.
            </label>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="button" disabled={busy}>{busy ? "Sending…" : "Email me a link"}</button>
        </form>
      )}
      <p className="notice">
        <button type="button" className="linklike" onClick={onClearDevice}>Clear my answers from this device</button>
      </p>
    </section>
  );
}

function ConsultCta({ body, summary, signedIn, linked, phone, onLinked }: {
  body: FamilyPlanBody; summary: FamilyPlanSummary | null; signedIn: boolean; linked: boolean; phone: string; onLinked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  if (done) {
    return (
      <section className={`${styles.card} ${styles.cta}`} aria-live="polite">
        <h2 ref={headingRef} tabIndex={-1}>Thank you. We have your request.</h2>
        <p>We will be in touch to set up your consult. {signedIn ? "If you used the email you saved your plan with, the attorney will see its summary before you meet." : ""} Keep adding to your plan before you meet if you like.</p>
      </section>
    );
  }
  return (
    <section className={`${styles.card} ${styles.cta}`} aria-labelledby="fp-cta-h">
      <h2 id="fp-cta-h">Ready to make it real?</h2>
      <p>
        {signedIn
          ? "Book a consult with the same email you saved with. The attorney sees your organized picture first (counts, value ranges and the list above, not your names or notes), so your meeting starts with decisions instead of paperwork."
          : "Book a consult and the attorney sees your organized picture first. Save your plan above, then book with the same email, so your meeting starts with decisions instead of paperwork."}
      </p>
      {linked && <p className="notice">Your plan is already linked to your request with us.</p>}
      {!open ? (
        <p className="cta-row">
          <button type="button" className="button" onClick={() => { setOpen(true); track("cta_book", { from: "family_plan" }); }}>Book a consult</button>
          <a className="button ghost-light" href={`tel:${phone.replace(/\D/g, "")}`}>Call {phone}</a>
        </p>
      ) : (
        <LeadForm
          tool="family_plan"
          answers={answersFromPlan(body, summary ?? undefined)}
          result={summary ? organizerSignals(summary) : undefined}
          legend="How can we reach you to set up your consult?"
          why="Flat fee, quoted before you sign. No obligation to hire us."
          submitLabel="Request my consult"
          defaultState={body.people.homeState}
          askLastName
          askPreferredContact
          askGoals
          onBack={() => setOpen(false)}
          onSuccess={() => {
            track("lead_capture", { kind: "consult", from: "family_plan" });
            if (signedIn) onLinked();
            setDone(true);
          }}
        />
      )}
      <p className="notice">Prefer to read first? <Link href="/guides">Browse the guides</Link>.</p>
    </section>
  );
}
