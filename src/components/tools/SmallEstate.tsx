"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { EmailCapture, track } from "@/components/capture";
import { Money, usd } from "./shared";
import {
  SMALL_ESTATE_DISCLAIMER,
  STATE_NAMES,
  courtSearchUrl,
  smallEstate,
  stateName,
  validateDeathDate,
  parseDate,
  type SmallEstateResult,
  type Tri,
} from "@/lib/tools/smallEstate";

const SLUG = "small-estate-checker";

function fmtDate(iso: string): string {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : iso;
}

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

const TRI: { value: Tri; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "I don't know yet" },
];

export default function SmallEstate({ initialState }: { initialState?: string }) {
  const [state, setState] = useState(initialState && STATE_NAMES[initialState.toUpperCase()] ? initialState.toUpperCase() : "");
  const [deathDate, setDeathDate] = useState("");
  const [hasWill, setHasWill] = useState<Tri | "">("");
  const [personal, setPersonal] = useState(0);
  const [personalTouched, setPersonalTouched] = useState(false);
  const [vehicles, setVehicles] = useState(0);
  const [realProperty, setRealProperty] = useState<"none" | "yes" | "">("");
  const [rpValue, setRpValue] = useState(0);
  const [spouse, setSpouse] = useState<"yes" | "no" | "">("");
  const [spouseAll, setSpouseAll] = useState<"yes" | "no" | "unsure" | "">("");
  const [probateOpen, setProbateOpen] = useState<Tri | "">("");
  const started = useRef(false);
  const completed = useRef(false);
  const touch = () => {
    if (!started.current) {
      started.current = true;
      track("tool_start", { tool_id: SLUG });
    }
  };

  const today = new Date();
  const dateError = deathDate ? validateDeathDate(deathDate, today) : null;
  const covered = ["CA", "TX", "FL", "NY", "PA", "IL", "OH", "GA", "NC", "MI"].includes(state);
  const hasSpouseRule = state === "OH" || state === "NC";
  const ready =
    !!state &&
    !!deathDate &&
    !dateError &&
    !!probateOpen &&
    (!covered || probateOpen === "yes" || (!!hasWill && personalTouched && !!realProperty));

  let r: SmallEstateResult | null = null;
  if (ready) {
    r = smallEstate(
      {
        state,
        deathDate,
        hasWill: (hasWill || "unknown") as Tri,
        personalValue: personal,
        vehiclesValue: vehicles,
        realProperty: realProperty === "yes" ? "yes" : "none",
        realPropertyValue: rpValue,
        spouse: spouse || undefined,
        spouseSoleHeir: spouseAll || undefined,
        probateOpen: probateOpen as Tri,
      },
      today,
    );
    if (!completed.current) {
      completed.current = true;
      track("tool_complete", { tool_id: SLUG });
    }
  }

  const name = stateName(state);

  return (
    <>
      <div className="tool">
        <p className="notice" style={{ marginTop: 0 }}>
          We are sorry for your loss. There is no rush here. These questions help show which simpler routes may be open. Nothing you enter leaves this page unless you choose to email yourself a copy.
        </p>
        <fieldset className="question">
          <legend>Which state did the person live in when they died?</legend>
          <p className="notice" style={{ marginTop: 0 }}>If they owned real estate in another state, that state&apos;s rules apply to that property.</p>
          <label className="field">
            State
            <select value={state} onChange={(e) => { touch(); setState(e.target.value); }}>
              <option value="">Choose a state</option>
              {Object.entries(STATE_NAMES).map(([code, n]) => <option key={code} value={code}>{n}</option>)}
            </select>
          </label>
        </fieldset>

        {state && (
          <fieldset className="question">
            <legend>What was the date of death?</legend>
            <p className="notice" style={{ marginTop: 0 }}>Limits in some states depend on the date. It can be any date.</p>
            <label className="field">
              Date of death
              <input type="date" value={deathDate} onChange={(e) => { touch(); setDeathDate(e.target.value); }} />
            </label>
            {dateError && deathDate && <p className="notice" role="alert">{dateError}</p>}
          </fieldset>
        )}

        {state && deathDate && !dateError && (
          <>
            <Choice legend="Has anyone already started probate?" value={probateOpen} options={TRI} onChange={(v) => { touch(); setProbateOpen(v); }} />
            {probateOpen === "yes" && <p className="notice">Then the routes here may no longer apply. An attorney can tell you.</p>}
          </>
        )}

        {state && covered && deathDate && !dateError && probateOpen && probateOpen !== "yes" && (
          <>
            <Choice legend="Did the person leave a will?" value={hasWill} options={TRI} onChange={(v) => { touch(); setHasWill(v); }} />
            <fieldset className="question">
              <legend>About how much did the person own in their name alone?</legend>
              <div className="row">
                <Money
                  label="Bank accounts, vehicles, investments without a beneficiary"
                  value={personal}
                  onChange={(n) => { touch(); setPersonal(n); setPersonalTouched(true); }}
                  help="Leave out accounts with a named beneficiary or joint owner, life insurance, and retirement accounts with a beneficiary. Those usually do not go through probate. Leave out real estate here; it is asked about next. Enter 0 if there was nothing."
                />
                {state === "IL" && (
                  <Money label="Of that, vehicles" value={vehicles} onChange={setVehicles} help="Illinois leaves vehicles out of the count." />
                )}
              </div>
              {!personalTouched && <button type="button" className="button" onClick={() => setPersonalTouched(true)}>There was nothing like this</button>}
            </fieldset>
            <Choice
              legend="Did the person own real estate in their name alone in this state?"
              value={realProperty}
              options={[{ value: "none", label: "No" }, { value: "yes", label: "Yes" }]}
              onChange={(v) => { touch(); setRealProperty(v); }}
            />
            {realProperty === "yes" && (
              <div className="row">
                <Money label="About what is the real estate worth?" value={rpValue} onChange={setRpValue} />
              </div>
            )}
            {hasSpouseRule && (
              <>
                <Choice legend="Did the person have a surviving spouse?" value={spouse} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} onChange={setSpouse} />
                {spouse === "yes" && (
                  <Choice
                    legend="Would the spouse receive everything?"
                    value={spouseAll}
                    options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unsure", label: "Not sure" }]}
                    onChange={setSpouseAll}
                  />
                )}
              </>
            )}
          </>
        )}

        {r && (
          <div className="result" aria-live="polite">
            <ResultBody r={r} state={state} name={name} deathDate={deathDate} />
          </div>
        )}
      </div>

      {r && (
        <>
          <EmailCapture
            kind="report"
            interest={`tool:${SLUG}`}
            sensitive
            title={covered ? `Email me the small estate steps for ${name}` : `Let me know when ${name} is added`}
            body={
              covered
                ? "We will send the steps, where to look for the form, and a checklist of what banks commonly ask for. You will get no sales emails. Take your time."
                : "We will send one email when this checker covers your state. You will get no sales emails."
            }
            cta={covered ? "Send it to me" : "Notify me"}
            details={{ state, verdict: r.verdict }}
          />
          <p className="notice">
            Talk it through with an attorney if you would like a person to look at the details.{" "}
            <Link href="/plan-finder">Book a consult</Link>
          </p>
          <p className="notice">{SMALL_ESTATE_DISCLAIMER}</p>
        </>
      )}
    </>
  );
}

function ResultBody({ r, state, name, deathDate }: { r: SmallEstateResult; state: string; name: string; deathDate: string }) {
  const rule = r.rule;
  const capText = r.cap === null || r.cap === undefined ? null : usd(r.cap);
  const source = rule && (
    <p className="notice">
      Source: <a href={rule.source} target="_blank" rel="noopener noreferrer">{rule.statuteCite}</a>, checked {fmtDate(rule.asOf)}
      {rule.confidence === "medium" ? ". Figure from a secondary source; an attorney can confirm it" : ""}.
    </p>
  );
  const wait =
    r.waitUntil && rule?.waitDays ? (
      <p>
        {name} generally requires waiting {rule.waitDays} days after the death, until about {fmtDate(r.waitUntil)}, before this route is used.
        {r.waitUntil < new Date().toISOString().slice(0, 10) ? " That date has already passed." : ""}
      </p>
    ) : null;
  const willNote = r.willUnknown ? <p>If a will is found, the route may change.</p> : null;
  const rpNote = rule?.realPropertyNote ? <p>{rule.realPropertyNote}</p> : null;
  const count = r.counted !== undefined && capText ? (
    <p>
      Based on what you entered, the property counted is {usd(r.counted)}. {name}&apos;s limit is {capText} for a death on {fmtDate(deathDate)}.
    </p>
  ) : null;

  let body: React.ReactNode;
  switch (r.verdict) {
    case "likely_affidavit":
      body = (
        <>
          <p className="big" style={{ fontSize: "1.5rem" }}>This estate may qualify for a small estate affidavit in {name}.</p>
          {count}
          {wait}
          <p>The affidavit is a signed statement, usually given to the bank or other holder of each asset, that you are entitled to the property. {name} has its own form and rules. This is not a court order, and each bank can have its own requirements.</p>
          {willNote}
          {source}
        </>
      );
      break;
    case "likely_court_simplified":
      body = (
        <>
          <p className="big" style={{ fontSize: "1.5rem" }}>This estate may qualify for a shorter court process in {name}.</p>
          {r.muniment ? (
            <p>The Texas small estate affidavit is for estates without a will. When there is a will, a muniment of title is a common shorter court route. It still involves a court filing and a judge&apos;s approval.</p>
          ) : (
            <p>The route is called {rule?.routeName}. It still involves a court filing{r.courtRequired && state !== "NY" ? " and a judge's approval" : ""}{state === "NY" ? ", handled through the Surrogate's Court clerk" : ""}.</p>
          )}
          {r.cap === null && state === "FL" ? (
            <p>In Florida, summary administration is also available when the person died more than two years ago, whatever the value of the estate. That is why no dollar limit was applied here.</p>
          ) : (
            count
          )}
          {state === "OH" && r.cap === 100_000 && <p>The higher figure applies because you said the spouse receives everything (summary release).</p>}
          {wait}
          {willNote}
          {source}
        </>
      );
      break;
    case "partial_real_property_needs_other_route":
      body = (
        <>
          <p className="big" style={{ fontSize: "1.5rem" }}>The money and personal property may qualify for the simplified route, but the real estate generally does not transfer that way in {name}.</p>
          <p>A different filing is usually needed for the property.</p>
          {rpNote}
          {count}
          {wait}
          {willNote}
          {source}
        </>
      );
      break;
    case "no_dollar_route_try_petition":
      body = (
        <>
          <p className="big" style={{ fontSize: "1.5rem" }}>Georgia has no small estate affidavit with a dollar limit.</p>
          <p>If there is no will and all the heirs agree, a petition for an order that no administration is necessary may work. It is a court filing, and it can cover real estate. A separate rule for bank deposits also exists; an attorney can tell you whether it fits.</p>
          {willNote}
          {source}
        </>
      );
      break;
    case "likely_formal_probate":
      body = (
        <>
          <p className="big" style={{ fontSize: "1.5rem" }}>On these numbers, a regular probate case is the usual path in {name}.</p>
          {r.reasonCode === "will_exists" ? (
            <p>The simplified route here is generally for estates without a will.</p>
          ) : (
            <>
              {count}
              {r.spouseCapIfSoleHeir && <p>If the spouse receives everything, a higher limit of {usd(r.spouseCapIfSoleHeir)} may apply, which could change this answer.</p>}
            </>
          )}
          <p>Probate is common and manageable. You can see what it may involve with our <Link href="/tools/probate-cost-estimator">probate cost estimator</Link>.</p>
          {willNote}
          {source}
        </>
      );
      break;
    case "state_not_covered":
      body = (
        <>
          <p className="big" style={{ fontSize: "1.5rem" }}>This checker does not have {name}&apos;s rules yet.</p>
          <p>Most states have some simpler route for smaller estates, and the limits and steps differ a lot. Your state court&apos;s self-help pages are a good place to start.</p>
          <p><a href={courtSearchUrl(state)} target="_blank" rel="noopener noreferrer">search your state court&apos;s small estate page</a></p>
          <p>If you would like, leave your email below and we will let you know when {name} is added.</p>
        </>
      );
      break;
    default:
      body = (
        <>
          <p className="big" style={{ fontSize: "1.5rem" }}>We can&apos;t tell from this tool. An attorney can review the details for you.</p>
          {r.reasonCode === "probate_open" && <p>Probate has already been started, so the routes here may no longer apply.</p>}
          {r.reasonCode === "date_outside_data" && <p>For a death on {fmtDate(deathDate)}, we do not hold the limit that applied in {name}.</p>}
          {r.reasonCode === "facts_unverified" && <p>We have not been able to confirm {name}&apos;s current figure, so we are not showing one.</p>}
        </>
      );
  }

  const covered = r.verdict !== "state_not_covered";
  return (
    <>
      {body}
      {covered && rule && (
        <div className="two-col">
          <div className="card">
            <strong>What counts toward the limit</strong>
            <ul>
              <li>Property in the person&apos;s name alone.</li>
              {rule.excludedFromCap.map((x) => <li key={x}>Usually left out: {x.charAt(0).toLowerCase() + x.slice(1)}.</li>)}
              <li>Assets that pass by beneficiary designation, joint ownership or a trust do not count.</li>
            </ul>
          </div>
          <div className="card">
            <strong>What this does not cover</strong>
            <ul>
              <li>Debts and taxes still apply, and creditors may need to be paid.</li>
              <li>If debts are larger than the assets, other rules may apply.</li>
              <li>Property in other states may need its own proceeding.</li>
              <li>Disagreements among family members.</li>
              <li>If you are named executor, deadlines may apply, such as filing a will with the court in some states.</li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
