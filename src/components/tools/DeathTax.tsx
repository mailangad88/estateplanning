"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmailCapture, track } from "@/components/capture";
import { FIGURES } from "@/config/figures";
import {
  NET_WORTH_BANDS,
  STATUS_LABEL,
  FEDERAL_TOP_RATE_PCT,
  checkDeathTax,
  needsHeirs,
  type Heirs,
  type NetWorthBand,
  type Status,
} from "@/lib/tools/deathTax";
import { ALL_STATE_CODES, INHERITANCE_TAX_META, STATE_NAMES, STATE_TABLE_SOURCE } from "@/lib/tools/deathTaxData";
import { Money, usd } from "./shared";

const TOOL_ID = "state-death-tax-checker";

function figureLabel(asOf: string): string {
  const year = new Date().getFullYear();
  const y = Number(asOf.slice(0, 4));
  return y < year ? `${asOf} figure, verify for ${year}` : `${asOf} figure`;
}

function Source({ href, label, asOf }: { href: string; label: string; asOf: string }) {
  return (
    <span className="notice" style={{ display: "block" }}>
      Source: <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>. {figureLabel(asOf)}.
    </span>
  );
}

function Pill({ status }: { status: Status }) {
  return <strong>{STATUS_LABEL[status]}</strong>;
}

export default function DeathTax({ initialState }: { initialState?: string }) {
  const start = initialState && ALL_STATE_CODES.includes(initialState.toUpperCase()) ? initialState.toUpperCase() : "";
  const [state, setState] = useState(start);
  const [died, setDied] = useState(false);
  const [marital, setMarital] = useState<"single" | "married">("single");
  const [band, setBand] = useState<NetWorthBand | "">("");
  const [exact, setExact] = useState(0);
  const [propertyState, setPropertyState] = useState("");
  const [propertyValue, setPropertyValue] = useState(0);
  const [heirs, setHeirs] = useState<Heirs | "">("");
  const [heirAmount, setHeirAmount] = useState(0);
  const started = useRef(false);
  const completed = useRef(false);

  const touch = () => {
    if (!started.current) {
      started.current = true;
      track("tool_start", { tool_id: TOOL_ID });
    }
  };

  const ready = Boolean(state) && (Boolean(band) || exact > 0);
  const askHeirs = Boolean(state) && needsHeirs(state, propertyState || undefined);
  const r = useMemo(
    () =>
      ready
        ? checkDeathTax({
            state,
            marital,
            netWorth: band || null,
            exactNetWorth: exact,
            propertyState: propertyState || undefined,
            propertyValue,
            heirs: askHeirs && heirs ? heirs : undefined,
            heirAmount,
          })
        : null,
    [ready, state, marital, band, exact, propertyState, propertyValue, askHeirs, heirs, heirAmount],
  );

  useEffect(() => {
    if (r && !completed.current) {
      completed.current = true;
      track("tool_complete", { tool_id: TOOL_ID });
    }
  }, [r]);

  const name = state ? STATE_NAMES[state] : "";
  const gentle = died;

  return (
    <>
      <div className="tool" onChange={touch}>
        <fieldset>
          <legend>Which state does the person live in{died ? " (or did they live in)" : ""}?</legend>
          <label className="field">
            State
            <select value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Choose a state</option>
              {ALL_STATE_CODES.map((s) => <option key={s} value={s}>{STATE_NAMES[s]}</option>)}
            </select>
          </label>
        </fieldset>

        <label className="check">
          <input type="checkbox" checked={died} onChange={(e) => setDied(e.target.checked)} />
          <span>I am asking about someone who has already died</span>
        </label>

        <fieldset>
          <legend>Which describes the person?</legend>
          <label className="check">
            <input type="radio" name="marital" checked={marital === "single"} onChange={() => setMarital("single")} />
            <span>Single, divorced or widowed</span>
          </label>
          <label className="check">
            <input type="radio" name="marital" checked={marital === "married"} onChange={() => setMarital("married")} />
            <span>Married</span>
          </label>
        </fieldset>

        <fieldset>
          <legend>What is the total value of everything owned, minus what is owed?</legend>
          <p className="notice">
            Count the home, bank and investment accounts, retirement accounts, life insurance owned by the person, business interests and personal property. For a married couple, enter what they own together. Life insurance owned by an irrevocable trust is commonly left out; an attorney can tell you how it is treated.
          </p>
          {NET_WORTH_BANDS.map((b) => (
            <label className="check" key={b.value}>
              <input type="radio" name="networth" checked={band === b.value} onChange={() => setBand(b.value)} />
              <span>{b.label}</span>
            </label>
          ))}
          <Money label="Or enter an exact amount instead (optional)" value={exact} onChange={setExact} help="An exact amount gives a sharper answer than a range." />
        </fieldset>

        <fieldset>
          <legend>Is real estate owned in a different state?</legend>
          <label className="field">
            Other state
            <select value={propertyState} onChange={(e) => setPropertyState(e.target.value)}>
              <option value="">None</option>
              {ALL_STATE_CODES.filter((s) => s !== state).map((s) => <option key={s} value={s}>{STATE_NAMES[s]}</option>)}
            </select>
          </label>
          {propertyState && <Money label="About how much is that property worth? (optional)" value={propertyValue} onChange={setPropertyValue} />}
        </fieldset>

        {askHeirs && (
          <fieldset>
            <legend>Who would receive most of what is left?</legend>
            {(["spouse", "children", "siblings", "others"] as Heirs[]).map((h) => (
              <label className="check" key={h}>
                <input type="radio" name="heirs" checked={heirs === h} onChange={() => setHeirs(h)} />
                <span>{{ spouse: "A spouse", children: "Children or grandchildren", siblings: "Brothers or sisters", others: "Other people or organizations" }[h]}</span>
              </label>
            ))}
            {state === "PA" && heirs && heirs !== "spouse" && (
              <Money label="About how much would go to them?" value={heirAmount} onChange={setHeirAmount} />
            )}
          </fieldset>
        )}

        <div className="result" aria-live="polite">
          {!r ? (
            <p className="notice">Choose a state and a value to see the three separate checks: federal estate tax, state estate tax and inheritance tax.</p>
          ) : (
            <>
              <h2>{gentle ? "What this may mean for the estate" : "Does a death tax apply?"}</h2>
              <p className="notice">
                People mix up three taxes. The federal and state estate taxes are paid by the estate before heirs receive anything. An inheritance tax is paid by the heir, at a rate that depends on the relationship.
              </p>

              <h3>Federal estate tax: <Pill status={r.federal.status} /></h3>
              {r.federal.suppressed ? (
                <p>The federal exemption is set by law and is large. Ask an attorney for the current figure before relying on it.</p>
              ) : (
                <p>
                  The federal exemption is {usd(FIGURES.federalExemption)} per person, or {usd(FIGURES.federalExemption * 2)} for a married couple that elects portability. Estates above it face rates up to {FEDERAL_TOP_RATE_PCT}% on the excess. The amount you entered puts the estate {r.federal.status === "could_be_either" ? "close enough to the line that an exact number is needed" : r.federal.status === "above" ? "above the exemption" : r.federal.status === "approaching" ? "within reach of the exemption" : "well below the exemption"}. The exemption is set by law and can change.
                  {r.federal.portabilityNote && " Portability carries over a spouse's unused exemption, and it commonly requires a timely federal estate tax return after the first death."}
                </p>
              )}
              <Source href={r.federal.source} label="IRS estate tax" asOf={r.federal.asOf} />

              <h3>
                State estate tax in {name}:{" "}
                {r.stateEstate.kind === "none" ? <strong>No state estate tax</strong> : r.stateEstate.status ? <Pill status={r.stateEstate.status} /> : <strong>Applies above a threshold</strong>}
              </h3>
              {r.stateEstate.kind === "none" ? (
                <p>
                  {name} has no state estate tax{r.inheritance.hasTax ? "" : " or inheritance tax"}. Federal rules and any property owned in another state can still matter.
                </p>
              ) : r.stateEstate.suppressed ? (
                <p>{name} taxes estates above a threshold, but the figure on file is out of date, so it is not shown here. Ask an attorney for the current number.</p>
              ) : (
                <>
                  <p>
                    {name} taxes estates above {usd(r.stateEstate.exemption as number)}. {marital === "married" ? "For a married couple the state threshold is generally applied to the combined estate, since the tax often arises at the second death. " : ""}
                    {r.stateEstate.portable === false ? `${name} does not let a surviving spouse carry over an unused exemption. ` : ""}
                    State rates reach as high as {r.stateEstate.topRatePct}% on the part above the exemption. The actual amount depends on a rate table an attorney or tax preparer applies, so no dollar figure is shown.
                  </p>
                  {r.stateEstate.cliff && (
                    <p>
                      {r.stateEstate.note} Here that means a limit of {usd(r.stateEstate.limit as number)}. This is why people near the line often ask about planning.
                    </p>
                  )}
                  {!r.stateEstate.cliff && r.stateEstate.note && <p>{r.stateEstate.note}</p>}
                </>
              )}
              {r.stateEstate.kind === "estate_tax" && r.stateEstate.source && (
                <Source href={r.stateEstate.source} label={`Tax Foundation state table (${r.stateEstate.cite})`} asOf={r.stateEstate.asOf as string} />
              )}

              <h3>
                Inheritance tax:{" "}
                <strong>{r.inheritance.hasTax ? `${name} has one` : "Not in " + name}</strong>
              </h3>
              {!r.inheritance.hasTax ? (
                <p>{name} does not have an inheritance tax. Property in another state can be a different story.</p>
              ) : r.inheritance.computable ? (
                <>
                  <ul>{INHERITANCE_TAX_META[state].classes.map((c) => <li key={c.heir}>{c.label}</li>)}</ul>
                  {r.inheritance.spouseExempt ? (
                    <p>Spouses pay no Pennsylvania inheritance tax.</p>
                  ) : r.inheritance.taxUsd !== null && r.inheritance.rate !== null ? (
                    <p>
                      On {usd(heirAmount)} the tax would be about <strong>{usd(r.inheritance.taxUsd)}</strong> at {r.inheritance.rate * 100}%, or about {usd(r.inheritance.taxEarlyUsd as number)} if paid within 3 months. Property that passes to a charity is commonly exempt.
                    </p>
                  ) : (
                    <p>Pick who would receive the assets, and an amount, to see an example.</p>
                  )}
                  <p className="notice">{r.inheritance.note}</p>
                </>
              ) : (
                <p>{r.inheritance.note} Rates are not shown here because the class tables for {name} have not been confirmed. Ask an attorney.</p>
              )}
              {r.inheritance.hasTax && r.inheritance.source && (
                <Source href={r.inheritance.source} label={`${name} revenue agency (${r.inheritance.cite})`} asOf={r.inheritance.asOf as string} />
              )}

              {r.property && (
                <>
                  <h3>Real estate in {STATE_NAMES[r.property.state]}</h3>
                  <p>
                    {r.property.hasEstateTax
                      ? `${STATE_NAMES[r.property.state]} can tax real property located there even when the owner lives elsewhere.`
                      : r.property.hasInheritanceTax
                        ? `${STATE_NAMES[r.property.state]} has an inheritance tax that can reach real property located there. Ask an attorney how it applies.`
                        : `${STATE_NAMES[r.property.state]} has no state estate or inheritance tax.`}
                    {r.property.status && ` The value entered is ${STATUS_LABEL[r.property.status].toLowerCase()} the ${usd(r.property.exemption as number)} threshold there.`}
                    {r.property.suppressed && " The threshold on file is out of date, so it is not shown. Ask an attorney."}
                  </p>
                </>
              )}

              {r.showExactPrompt && <p className="notice">The range you chose crosses a threshold. Enter an exact amount above for a sharper answer.</p>}

              <h3>What people often do next</h3>
              <p>
                Those near a threshold often ask about gifting strategies, trusts designed for married couples and who owns life insurance. These have trade-offs, including a possible loss of the income tax basis step-up on gifted property. Ask an attorney.
              </p>
              <p className="notice">
                These numbers move. State figures are from the{" "}
                <a href={STATE_TABLE_SOURCE} target="_blank" rel="noopener noreferrer">Tax Foundation table</a>; most are 2025 figures, verify for {FIGURES.year}. Tax law is complex and changes. This does not account for prior gifts, special elections or state rules not listed. This is general information, not legal advice, and using it does not create an attorney-client relationship.
              </p>

              <h3>When to talk to an attorney</h3>
              <p>
                {gentle
                  ? "If the estate is near or above a threshold, or the state has an inheritance tax, filing deadlines can be short. Talk it through with an attorney."
                  : "If your estate is near or above a threshold, or your state has an inheritance tax, planning may matter. An attorney can look at your whole picture."}{" "}
                <Link href="/plan-finder">{gentle ? "Talk it through with an attorney" : "Book a consult"}</Link>
              </p>
            </>
          )}
        </div>
      </div>

      {r && (
        <EmailCapture
          kind="report"
          interest={`tool:${TOOL_ID}`}
          title="Email me this result and the exposure sheet"
          body={
            gentle
              ? "We'll send your result, the thresholds for the states you entered and a short checklist for a conversation with an attorney. You will get no sales emails."
              : "We'll send your result, the thresholds for the states you entered, an inventory worksheet and a short checklist for a conversation with an attorney."
          }
          sensitive={died}
          details={{
            state,
            married: marital === "married",
            federal: r.federal.status,
            stateStatus: r.stateEstate.status ?? r.stateEstate.kind,
            inheritanceState: r.inheritance.hasTax,
            outOfStateProperty: Boolean(r.property),
          }}
        />
      )}
    </>
  );
}
