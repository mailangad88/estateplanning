"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { EmailCapture, track } from "@/components/capture";
import { US_STATES } from "@/config/firm";
import {
  ACCOUNT_OPTIONS, BAND_LABEL, BAND_LINE, EVENT_OPTIONS, PRIMARY_OPTIONS,
  audit, isCommunityProperty, needsConsultNote,
  type AccountKind, type Contingent, type Entry, type LastReview, type LifeEvent, type Marital, type Primary,
} from "@/lib/tools/beneficiaryAudit";

const TOOL = "beneficiary-audit";
const BLANK: Entry = { primary: "blank", contingent: "unsure", lastReview: "never" };
const label = (kind: string) => ACCOUNT_OPTIONS.find((a) => a.value === kind)?.label ?? kind;
const SEV: Record<string, string> = { high: "Higher concern", medium: "Worth a look", low: "Minor" };

export default function BeneficiaryAudit({ initialState }: { initialState?: string } = {}) {
  const [state, setState] = useState(initialState ?? "");
  const [marital, setMarital] = useState<Marital>("single");
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [selected, setSelected] = useState<AccountKind[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [shown, setShown] = useState(false);
  const started = useRef(false);
  const completed = useRef(false);

  const start = () => {
    if (!started.current) {
      started.current = true;
      track("tool_start", { tool_id: TOOL });
    }
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const setEntry = (k: string, patch: Partial<Entry>) => setEntries((m) => ({ ...m, [k]: { ...(m[k] ?? BLANK), ...patch } }));

  const cp = state ? isCommunityProperty(state) : false;
  const result = shown
    ? audit(Object.fromEntries(selected.map((k) => [k, entries[k] ?? BLANK])), { marital, events, cp })
    : null;

  function show() {
    setShown(true);
    if (!completed.current) {
      completed.current = true;
      track("tool_complete", { tool_id: TOOL });
    }
  }

  const edit = () => setShown(false);

  if (shown && !result) {
    return (
      <>
        <h2>Your beneficiary audit</h2>
        <div className="result" aria-live="polite">
          <p>No accounts selected. If you aren&apos;t sure, look for statements from your employer&apos;s plan, bank and insurer.</p>
        </div>
        <button type="button" className="button" onClick={edit}>Go back</button>
      </>
    );
  }

  if (result) {
    const sorted = result.per.slice().sort((a, b) => a.score - b.score);
    const flagCodes = Array.from(new Set(result.per.flatMap((p) => p.flags.map((f) => f.code)))).join(",");
    return (
      <>
        <h2>Your beneficiary audit</h2>
        <div className="result" aria-live="polite">
          <p className="big">{result.overall}/100: {BAND_LABEL[result.band]}</p>
          <p>{BAND_LINE[result.band]}</p>
          <p className="notice">This score is a rough guide to how many things to check. It is not a legal opinion.</p>
        </div>

        {sorted.map((p) => (
          <div className="card" key={p.kind}>
            <strong>{label(p.kind)}</strong>: {p.score}/100
            {p.flags.length === 0 && <p>Nothing stood out on this one.</p>}
            {p.flags.map((f) => (
              <div key={f.code} style={{ marginTop: "0.75rem" }}>
                <p style={{ margin: 0 }}><strong>{SEV[f.sev]}.</strong> {f.text}</p>
                <p className="notice" style={{ margin: "0.25rem 0 0" }}>
                  What to ask the plan or company: {f.ask} Source: <a href={f.source} rel="noopener noreferrer">{f.cite}</a>, checked {f.asOf}.
                </p>
                {f.code === "spousal_consent" && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={!!entries[p.kind]?.waiver}
                      onChange={(e) => setEntry(p.kind, { waiver: e.target.checked })}
                    />
                    <span>A signed spousal waiver is on file</span>
                  </label>
                )}
              </div>
            ))}
            {p.notes.map((n) => <p className="notice" key={n}>{n}</p>)}
          </div>
        ))}

        <p className="notice">
          A beneficiary form usually overrides a will. That&apos;s why your will can say one thing and your accounts another.
          Per-stirpes choices and other form details are outside this tool. Rules differ by account type, plan terms and state.
          Your plan administrator or insurer controls how the form is processed. General information only, not legal advice.
        </p>

        <EmailCapture
          kind="report"
          interest={`tool:${TOOL}`}
          title="Email me the printable audit sheet"
          body="We'll send a printable beneficiary audit sheet with your account types filled in. No names or numbers are ever collected."
          details={{ overall: result.overall, band: result.band, accounts: selected.length, highFlags: result.highCount, flags: flagCodes }}
        />

        <div className="cta">
          <strong>When to talk to an attorney</strong>
          <p>
            {needsConsultNote(result)
              ? "A former spouse, a minor child or a person on benefits named directly, or several open items, are the usual reasons to get help before changing a form. "
              : "If a form conflicts with your will or trust, or you are unsure what to put, an attorney can help. "}
            <Link href="/plan-finder">Book a consult</Link>. Free printable checklist:{" "}
            <Link href="/free/beneficiary-designation-audit">beneficiary designation audit</Link>.
          </p>
        </div>
        <button type="button" className="button" onClick={edit}>Change my answers</button>
      </>
    );
  }

  return (
    <div className="tool" onChange={start}>
      <h2>Beneficiary audit</h2>
      <p className="lead">List your accounts and who is named. We never ask for names, account numbers or amounts.</p>

      <div className="row">
        <label className="field">
          Which state do you live in?
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Choose a state</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="field">
          Marital status
          <select value={marital} onChange={(e) => setMarital(e.target.value as Marital)}>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </label>
      </div>

      <fieldset className="question">
        <legend>Since you last updated your beneficiaries, which of these happened?</legend>
        {EVENT_OPTIONS.map((o) => (
          <label className="check" key={o.value}>
            <input type="checkbox" checked={events.includes(o.value)} onChange={() => setEvents((l) => toggle(l, o.value))} />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="question">
        <legend>Which of these do you have?</legend>
        {ACCOUNT_OPTIONS.map((o) => (
          <label className="check" key={o.value}>
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => setSelected((l) => toggle(l, o.value))} />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>

      {selected.map((k) => {
        const en = entries[k] ?? BLANK;
        return (
          <fieldset className="card" key={k}>
            <legend>{label(k)}</legend>
            <label className="field">
              Who is listed as the main beneficiary?
              <select value={en.primary} onChange={(e) => setEntry(k, { primary: e.target.value as Primary })}>
                {PRIMARY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="field">
              Is there a backup beneficiary?
              <select value={en.contingent} onChange={(e) => setEntry(k, { contingent: e.target.value as Contingent })}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unsure">Not sure</option>
              </select>
            </label>
            <label className="field">
              When did you last look at this form?
              <select value={en.lastReview} onChange={(e) => setEntry(k, { lastReview: e.target.value as LastReview })}>
                <option value="lt3">Within 3 years</option>
                <option value="3_5">3 to 5 years ago</option>
                <option value="gt5">More than 5 years ago</option>
                <option value="never">Never, or I don&apos;t remember</option>
              </select>
            </label>
          </fieldset>
        );
      })}

      <button type="button" className="button" onClick={show}>See my audit</button>
      <p className="notice">Answers stay in your browser until you ask us to email something.</p>
    </div>
  );
}
