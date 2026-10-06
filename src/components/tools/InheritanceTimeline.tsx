"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { EmailCapture, track } from "@/components/capture";
import {
  DISCLAIMER,
  ROUTE_LABELS,
  inheritanceTimeline,
  parseDate,
  validateDeathDate,
  type Phase,
  type Route,
} from "@/lib/tools/inheritanceTimeline";

const SLUG = "inheritance-timeline";
export const meta = { slug: SLUG, title: "When will I get my inheritance? A timeline" };

const fmt = (iso: string) => {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : iso;
};

const toneOf = (p: Phase) =>
  p.kind === "statute" ? "gold" : p.id === "dispute" ? "clay" : p.id === "estate_tax" ? "sage" : "accent";

function Choice<T extends string>({ legend, help, value, options, onChange }: { legend: string; help?: string; value: T | ""; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="question">
      <legend>{legend}</legend>
      {help && <p className="notice" style={{ marginTop: 0 }}>{help}</p>}
      {options.map((o) => (
        <label className="check" key={o.value}>
          <input type="radio" name={legend} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

const ROUTES = (Object.keys(ROUTE_LABELS) as Route[]).map((v) => ({ value: v, label: ROUTE_LABELS[v] }));
const YN = [{ value: "no" as const, label: "No, or not that I know of" }, { value: "yes" as const, label: "Yes, possibly" }];

export default function InheritanceTimeline({ initialState }: { initialState?: string }) {
  const state = (initialState ?? "IL").toUpperCase();
  const illinois = state === "IL";
  const [deathDate, setDeathDate] = useState("");
  const [route, setRoute] = useState<Route | "">("");
  const [disputes, setDisputes] = useState<"yes" | "no" | "">("");
  const [tax, setTax] = useState<"yes" | "no" | "">("");
  const [admission, setAdmission] = useState("");
  const [publication, setPublication] = useState("");
  const started = useRef(false);
  const completed = useRef(false);
  const touch = () => {
    if (!started.current) {
      started.current = true;
      track("tool_start", { tool_id: SLUG });
    }
  };

  const dateError = deathDate ? validateDeathDate(deathDate, new Date()) : null;
  const ready = !!deathDate && !dateError && !!route && !!disputes && !!tax;
  const isProbate = route === "probate_independent" || route === "probate_supervised";

  const r = ready
    ? inheritanceTimeline({
        deathDate,
        route: route as Route,
        disputes: disputes === "yes",
        estateTax: tax === "yes",
        admissionDate: admission || undefined,
        publicationDate: publication || undefined,
      })
    : null;
  if (r && !completed.current) {
    completed.current = true;
    track("tool_complete", { tool_id: SLUG });
  }

  return (
    <>
      <div className="tool">
        <p className="notice" style={{ marginTop: 0 }}>
          We are sorry for your loss. There is no rush here. These questions show the usual order of steps and how long each often takes. Nothing you enter leaves this page unless you choose to email yourself a copy.
        </p>
        {!illinois && (
          <p className="notice" role="note">
            This tool uses Illinois rules. The order of steps is similar in many states, but the deadlines and court rules differ, so treat the picture below as general only.
          </p>
        )}
        <fieldset className="question">
          <legend>What was the date of death?</legend>
          <label className="field">
            Date of death
            <input type="date" value={deathDate} onChange={(e) => { touch(); setDeathDate(e.target.value); }} />
          </label>
          {dateError && deathDate && <p className="notice" role="alert">{dateError}</p>}
        </fieldset>

        <Choice legend="How does the asset you are waiting for pass to you?" help="If you are waiting on several assets, run this once for each. They often move at different speeds." value={route} options={ROUTES} onChange={(v) => { touch(); setRoute(v); }} />
        <Choice legend="Is a dispute or a will contest likely?" help="For example, family members who disagree about the will, the trust or who gets what." value={disputes} options={YN} onChange={(v) => { touch(); setDisputes(v); }} />
        <Choice legend="Might the estate owe estate tax?" help="This only affects larger estates. If you are not sure, choose No and see the Illinois estate tax guide below." value={tax} options={YN} onChange={(v) => { touch(); setTax(v); }} />

        {isProbate && (
          <fieldset className="question">
            <legend>Optional: dates you already know</legend>
            <p className="notice" style={{ marginTop: 0 }}>If probate has started, these let the picture use your real dates instead of the earliest possible ones.</p>
            <label className="field">
              Date the will was admitted to probate
              <input type="date" value={admission} onChange={(e) => setAdmission(e.target.value)} />
            </label>
            <label className="field">
              Date the creditor notice was first published
              <input type="date" value={publication} onChange={(e) => setPublication(e.target.value)} />
            </label>
          </fieldset>
        )}

        {r && (
          <div className="result" aria-live="polite">
            <p className="big" style={{ fontSize: "1.5rem" }}>{r.overallText}</p>
            <p>{r.firstMoney}</p>
            <Timeline r={r} showCites={illinois} />
            <div className="dg-note"><strong>Honest note.</strong> {r.caveats.join(" ")}</div>
            <ul className="dg-ticks" style={{ marginTop: 16 }}>
              {r.phases.map((p) => (
                <li key={p.id}>
                  <span>
                    <strong>{p.label}.</strong> {p.range}. {p.note}
                    {illinois && p.unverifiedStatute && (
                      <> The length is set by Illinois law ({p.cite}). We have not re-checked the exact period against the statute, so we are not showing a date. Check it at <a href={p.source} target="_blank" rel="noopener noreferrer">ilga.gov</a>.</>
                    )}
                    {p.endDate && (
                      <> {p.endIsEarliest ? "No earlier than " : "Ends about "}<strong>{fmt(p.endDate)}</strong>{p.cite ? ` (${p.cite})` : ""}.</>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="notice">
              Related: <Link href="/free/probate-timeline-planner">probate timeline planner</Link>,{" "}
              <Link href="/free/executor-first-30-days-guide">executor first 30 days</Link>,{" "}
              <Link href="/free/illinois-estate-tax-guide">Illinois estate tax guide</Link>,{" "}
              <Link href="/free/contesting-a-will-basics-guide">contesting a will</Link>,{" "}
              <Link href="/tools/probate-cost-estimator">probate cost estimator</Link>.
            </p>
          </div>
        )}
      </div>

      {r && (
        <>
          <EmailCapture
            kind="report"
            interest={`tool:${SLUG}`}
            sensitive
            title="Email me this timeline"
            body="We will send the timeline and a short list of what to ask the executor or trustee. You will get no sales emails. Take your time."
            cta="Send it to me"
            details={{ route: r.route }}
          />
          <p className="notice">{DISCLAIMER} <Link href="/plan-finder">Find the right next step</Link></p>
        </>
      )}
    </>
  );
}

function Timeline({ r, showCites }: { r: ReturnType<typeof inheritanceTimeline>; showCites: boolean }) {
  const summary = r.phases
    .map((p) => `${p.label}: ${p.range}${p.endDate ? `, ${p.endIsEarliest ? "no earlier than " : "about "}${fmt(p.endDate)}` : ""}`)
    .join(". ");
  return (
    <figure className="dg-bars" style={{ margin: "20px 0" }}>
      <figcaption>Steps in order, left to right. Not to scale.</figcaption>
      <div role="img" aria-label={`Timeline for ${r.routeLabel}. ${summary}`}>
        <ol>
          {r.phases.map((p) => (
            <li key={p.id} className={`dg-tone--${toneOf(p)}`} style={{ gridTemplateColumns: "minmax(110px, 11rem) 1fr", alignItems: "start" }}>
              <span>{p.label}</span>
              <span>
                <span className="dg-bars__track" style={{ display: "block", position: "relative", height: 14 }}>
                  <span
                    className="dg-bars__fill"
                    style={{
                      position: "absolute",
                      left: `${p.start}%`,
                      width: `${Math.min(p.len, 100 - p.start)}%`,
                      ...(p.kind === "statute"
                        ? { background: "repeating-linear-gradient(135deg, var(--t) 0 6px, var(--t-tint) 6px 12px)", border: "1px solid var(--t)" }
                        : {}),
                    }}
                  />
                </span>
                <span style={{ display: "block", fontSize: "0.85rem", color: "var(--muted)", marginTop: 2 }}>
                  {p.range}
                  {p.endDate ? ` · ${p.endIsEarliest ? "no earlier than " : ""}${fmt(p.endDate)}` : ""}
                  {showCites && p.kind === "statute" && p.cite ? ` · ${p.cite}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption style={{ marginTop: 10, fontWeight: 400, fontSize: "0.85rem" }}>
        <span className="dg-swatch dg-tone--accent">Usual steps</span>{" "}
        <span className="dg-swatch dg-tone--gold">Set by law (hatched)</span>{" "}
        <span className="dg-swatch dg-tone--clay">If a dispute arises</span>{" "}
        <span className="dg-swatch dg-tone--sage">If estate tax is owed</span>
      </figcaption>
    </figure>
  );
}
