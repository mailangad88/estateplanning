"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmailCapture, track } from "@/components/capture";
import { US_STATES } from "@/config/firm";
import { STATE_NAMES } from "@/lib/tools/smallEstate";

const stateName = (code: string) => STATE_NAMES[code] ?? code;
import { FEDERAL } from "@/lib/tools/medicaidRunwayData";
import { GROWTH_ASSUMPTION_PCT, compute, formatMonths, validate, type Answers } from "@/lib/tools/medicaidRunway";
import { Money, usd } from "./shared";

const TOOL_ID = "medicaid-savings-runway";

function Src({ asOf, source, label }: { asOf: string; source: string; label: string }) {
  return (
    <>
      {" "}
      <a href={source} target="_blank" rel="noopener noreferrer">{label}</a>, checked {asOf}
    </>
  );
}

export default function MedicaidRunway({ initialState }: { initialState?: string } = {}) {
  const [a, setA] = useState<Answers>({
    state: initialState && (US_STATES as readonly string[]).includes(initialState) ? initialState : "",
    who: "parent",
    married: false,
    careCost: 0,
    applicantIncome: 0,
    countableAssets: 0,
    ownsHome: false,
    homeEquity: 0,
    growth: false,
    careSetting: "nursing_home",
    moveWithin14Days: false,
  });
  const started = useRef(false);
  const completed = useRef(false);
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => {
    if (!started.current) {
      started.current = true;
      track("tool_start", { tool_id: TOOL_ID });
    }
    setA((p) => ({ ...p, [k]: v }));
  };

  const v = validate(a);
  const out = useMemo(() => (v.ok ? compute(a) : null), [a, v.ok]);
  const as = out?.assumptions;
  const typical = useMemo(() => (a.state ? compute({ ...a, careCost: 1 }).assumptions.typicalCost : null), [a]);

  useEffect(() => {
    if (out && !completed.current) {
      completed.current = true;
      track("tool_complete", { tool_id: TOOL_ID });
    }
  }, [out]);

  const r = out?.runway;
  const place = a.state ? stateName(a.state) : "your state";
  const marriedLabel = a.who === "parent" ? "Is your parent married, with the spouse living at home?" : "Is the person who needs care married, with a spouse who is not in a facility?";

  return (
    <>
      <div className="tool">
        <fieldset className="field">
          <legend>Is a move into a nursing home expected within the next 14 days?</legend>
          <label className="check"><input type="radio" name="soon" checked={!a.moveWithin14Days} onChange={() => set("moveWithin14Days", false)} /><span>No</span></label>
          <label className="check"><input type="radio" name="soon" checked={a.moveWithin14Days} onChange={() => set("moveWithin14Days", true)} /><span>Yes, or it may happen very soon</span></label>
        </fieldset>

        {a.moveWithin14Days && <UrgentBlock />}

        <label className="field">
          Which state would the care be in?
          <select value={a.state} onChange={(e) => set("state", e.target.value)}>
            <option value="">Choose a state</option>
            {US_STATES.map((s) => <option key={s} value={s}>{stateName(s)}</option>)}
          </select>
        </label>

        <fieldset className="field">
          <legend>Who needs care?</legend>
          {([["me", "Me"], ["spouse", "My spouse"], ["parent", "A parent"], ["other", "Someone else"]] as const).map(([val, label]) => (
            <label className="check" key={val}><input type="radio" name="who" checked={a.who === val} onChange={() => set("who", val)} /><span>{label}</span></label>
          ))}
        </fieldset>

        <fieldset className="field">
          <legend>What kind of care?</legend>
          <label className="check"><input type="radio" name="setting" checked={a.careSetting === "nursing_home"} onChange={() => set("careSetting", "nursing_home")} /><span>Nursing home</span></label>
          <label className="check"><input type="radio" name="setting" checked={a.careSetting === "home_or_assisted"} onChange={() => set("careSetting", "home_or_assisted")} /><span>Care at home or assisted living</span></label>
        </fieldset>

        <fieldset className="field">
          <legend>{marriedLabel}</legend>
          <label className="check"><input type="radio" name="married" checked={!a.married} onChange={() => set("married", false)} /><span>No</span></label>
          <label className="check"><input type="radio" name="married" checked={a.married} onChange={() => set("married", true)} /><span>Yes</span></label>
        </fieldset>

        <div className="row">
          <div>
            <Money label="What does care cost per month? ($ per month)" value={a.careCost} onChange={(n) => set("careCost", n)} help="Include room, board and care." />
            {typical && a.careSetting === "nursing_home" && (
              <button type="button" className="button secondary" onClick={() => set("careCost", typical.value)}>
                Use a typical cost ({usd(typical.value)})
              </button>
            )}
            {typical && a.careSetting === "nursing_home" && (
              <p className="notice">
                Median private nursing home room in {place}, 2025 survey.
                <Src asOf={typical.asOf} source={typical.source} label="CareScout cost of care survey" />. Your facility may charge much more or less.
              </p>
            )}
          </div>
          <Money label="Monthly income of the person who needs care ($ per month)" value={a.applicantIncome} onChange={(n) => set("applicantIncome", n)} help="Social Security, pension, annuity, before Medicare premium deductions." />
        </div>

        <Money
          label={a.married ? "Total savings and investments, both spouses combined ($)" : "Total savings and investments ($)"}
          value={a.countableAssets}
          onChange={(n) => set("countableAssets", n)}
          help="Bank accounts, CDs, stocks, bonds, mutual funds and retirement accounts, as far as you know. Leave out the home you live in."
        />

        <fieldset className="field">
          <legend>Does the person (or couple) own a home?</legend>
          <label className="check"><input type="radio" name="home" checked={!a.ownsHome} onChange={() => set("ownsHome", false)} /><span>No</span></label>
          <label className="check"><input type="radio" name="home" checked={a.ownsHome} onChange={() => set("ownsHome", true)} /><span>Yes</span></label>
        </fieldset>
        {a.ownsHome && <Money label="Home equity: value minus any mortgage ($)" value={a.homeEquity} onChange={(n) => set("homeEquity", n)} />}

        <fieldset className="field">
          <legend>Should we assume care costs rise each year?</legend>
          <label className="check"><input type="radio" name="growth" checked={!a.growth} onChange={() => set("growth", false)} /><span>Keep costs level</span></label>
          <label className="check"><input type="radio" name="growth" checked={a.growth} onChange={() => set("growth", true)} /><span>Assume {GROWTH_ASSUMPTION_PCT}% a year (our assumption, not a forecast)</span></label>
        </fieldset>

        {!out && <p className="notice">Choose a state and enter the monthly cost to see how long savings could last.</p>}

        {out && r && as && (
          <div className="result" aria-live="polite">
            {a.careSetting === "home_or_assisted" && (
              <p className="notice">Many states cover care at home or in assisted living through waiver programs with different rules and waiting lists. The runway below still shows how long savings could last at the cost entered.</p>
            )}

            {r.status === "months" && out.range && (
              <p className="big">
                Savings could cover roughly {out.range.low} to {out.range.high} months of care
                {out.range.high >= 12 && <> ({formatMonths(out.range.low)} to {formatMonths(out.range.high)})</>}
              </p>
            )}
            {r.status === "months" && (
              <p>
                That is before reaching the Medicaid asset limit used for {place} ({usd(as.assetLimit)}). It assumes care costs {usd(a.careCost)} a month, income of {usd(a.applicantIncome)} a month goes to care, and about {usd(r.spendable)} of savings is used first.
                {a.growth ? ` Costs are assumed to rise ${GROWTH_ASSUMPTION_PCT}% a year.` : ""}
              </p>
            )}
            {r.status === "income_covers" && (
              <p className="big">Income covers the monthly cost, so savings would not be drawn down. Costs and income change, so it helps to revisit.</p>
            )}
            {r.status === "over_horizon" && (
              <p className="big">At these numbers savings could last more than 50 years. Costs and income change, so it helps to revisit.</p>
            )}
            {r.status === "already_near_limit" && (
              <>
                <p className="big">Countable assets are already near or below the limit we used.</p>
                <p>People in this position often ask about applying soon. An attorney can tell you what {place} requires.</p>
                <UrgentBlock />
              </>
            )}

            {a.married && r.protectedByCsra !== null && (
              <p>
                The spouse at home may be able to keep about {usd(r.protectedByCsra)} (the community spouse resource allowance, set by a federal formula between {usd(FEDERAL.csraMin.value)} and {usd(FEDERAL.csraMax.value)} in 2026).
                <Src asOf={FEDERAL.csraMax.asOf} source={FEDERAL.csraMax.source} label="CMS" />.
              </p>
            )}

            {out.crisis && r.status !== "already_near_limit" && !a.moveWithin14Days && (
              <p className="notice">With a year or less of savings, many families talk to an elder law attorney soon. <Link href="/plan-finder">Book a consult</Link>.</p>
            )}

            {out.homeEquityWarning && (
              <p className="notice">Your home equity may exceed some states&apos; limits (the 2026 range is {usd(FEDERAL.homeEquityMin.value)} to {usd(FEDERAL.homeEquityMax.value)}, state chooses).<Src asOf={FEDERAL.homeEquityMin.asOf} source={FEDERAL.homeEquityMin.source} label="CMS" /></p>
            )}

            <div className="notice">
              <strong>Assumptions and limits</strong>
              <ul>
                {as.assetLimitFact ? (
                  <li>Asset limit for a single applicant in {place}: {usd(as.assetLimitFact.value)}.<Src asOf={as.assetLimitFact.asOf} source={as.assetLimitFact.source} label="Source" /></li>
                ) : (
                  <li>Your state&apos;s limit may be different. We used {usd(as.assetLimit)}, a common figure. Ask an attorney.</li>
                )}
                {a.married && (as.csraFact ? (
                  <li>{place} commonly sets the spouse&apos;s share at {as.csraFact.value === "half" ? "half of the couple's assets, within the federal range" : "the federal maximum"}.<Src asOf={as.csraFact.asOf} source={as.csraFact.source} label="Source" /></li>
                ) : (
                  <li>How {place} sets the spouse&apos;s share may differ from the half-of-assets rule we used. Ask an attorney.</li>
                ))}
                {as.lookbackFact ? (
                  <li>Look-back period for transfers in {place}: {as.lookbackFact.value} months{as.lookbackFact.value !== 60 ? ", which may be phasing in" : ""}.<Src asOf={as.lookbackFact.asOf} source={as.lookbackFact.source} label="Source" /></li>
                ) : (
                  <li>Most states look back 60 months for gifts or transfers. Ask an attorney how it works in {place}.</li>
                )}
                {as.homeEquityFact && <li>Home equity limit in {place}: {usd(as.homeEquityFact.value)}.<Src asOf={as.homeEquityFact.asOf} source={as.homeEquityFact.source} label="Source" /></li>}
              </ul>
              <p>Not modeled: the allowance a spouse at home may receive from the other&apos;s income (between {usd(FEDERAL.mmmnaMin.value)} and {usd(FEDERAL.mmmnaMax.value)} a month in 2026), both spouses needing care, retirement accounts and annuities that some states treat differently, and any transfers already made.</p>
            </div>

            <details>
              <summary>How we calculated this</summary>
              <p>
                Care costs are paid first from the resident&apos;s income and then from countable savings until savings reach the asset limit. About {r.months !== null ? `${r.months} months` : "that long"} is the exact figure at these inputs; we show a range because costs and income change{out.spread > 0.15 ? " and because we had to assume a state rule" : ""}.
                For a married applicant, the protected amount is half the couple&apos;s countable assets, but not below {usd(CSRA_MIN_DISPLAY)} or above {usd(CSRA_MAX_DISPLAY)}, unless the state allows the maximum.
              </p>
            </details>

            <div className="notice">
              <strong>What Medicaid generally counts and does not</strong>
              <ul>
                <li>The home is commonly not counted up to a state equity cap, if a spouse lives there or the person intends to return.</li>
                <li>One car and personal belongings are commonly not counted.</li>
                <li>Prepaid funeral arrangements are not counted in many states. Ask an attorney.</li>
                <li>Gifts or sales below value in the look-back window can cause a penalty period.</li>
              </ul>
            </div>

            <p>
              What can legally be protected is a question for an elder law attorney. Giving money or property away in the look-back window can create a penalty period during which Medicaid won&apos;t pay. There are lawful strategies; there are also mistakes that can&apos;t be undone.
              See the <Link href="/tools/medicaid-lookback-date">look-back date tool</Link>.
            </p>

            <p className="notice">
              When to talk to an attorney: if savings may last a year or less, if a spouse lives at home, if a home is owned, or before giving away or moving any asset. <Link href="/plan-finder">Book a consult</Link>.
            </p>
            <p className="notice">
              This is general educational information, not legal advice, and using this tool does not create an attorney-client relationship. Medicaid rules differ by state and change often. This estimate is not an eligibility determination, and it is not advice about moving or giving away assets, which can trigger penalties. Ask an elder law attorney before you transfer anything. Dollar amounts are ranges for illustration.
            </p>
          </div>
        )}
      </div>

      {out && r && (
        <EmailCapture
          kind="report"
          interest={`tool:${TOOL_ID}`}
          title="Email me this estimate and a list of questions for an elder law attorney"
          body="We'll send your numbers, the questions to bring to an attorney, and a short checklist for a nursing home move. Your answers are used only to prepare this email, and you will get no sales emails."
          sensitive
          details={{
            state: a.state,
            married: a.married,
            who: a.who,
            monthsLow: out.range?.low ?? 0,
            monthsHigh: out.range?.high ?? 0,
            status: r.status,
            urgent: out.urgent,
          }}
        />
      )}
    </>
  );
}

const CSRA_MIN_DISPLAY = FEDERAL.csraMin.value;
const CSRA_MAX_DISPLAY = FEDERAL.csraMax.value;

function UrgentBlock() {
  return (
    <div className="cta" role="alert">
      <strong>A move this soon is worth a call to an attorney now</strong>
      <p>Use the Call button in the bar at the bottom of the screen, or <Link href="/plan-finder">book a consult</Link> and we will get back to you quickly. Please hold off on moving or giving away any money or property until you have talked it through.</p>
    </div>
  );
}
