"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import LeadForm, { type LeadResponse } from "@/components/LeadForm";
import ProbateVsTrustAnimation from "@/components/ProbateVsTrustAnimation";
import { US_STATES } from "@/config/firm";
import { toolConfig } from "@/config/tools";
import { estimateProbate } from "@/lib/tools/costEstimate";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const GUIDE = "probate-vs-trust-guide";

export default function ProbateCost({ initialState }: { initialState?: string } = {}) {
  const [state, setState] = useState(initialState ?? "");
  const [value, setValue] = useState(600_000);
  const [otherStates, setOtherStates] = useState(0);
  const [done, setDone] = useState<LeadResponse | null>(null);

  const estimate = useMemo(
    () => (state ? estimateProbate({ estateValue: value, state, otherStatesWithProperty: otherStates }) : null),
    [state, value, otherStates],
  );
  const fee = toolConfig.trustPlanFeeDollars;

  return (
    <>
      <h2>What could probate cost your family?</h2>
      <p className="lead">A rough, general range. No sign-up needed to see it.</p>

      <div className="card">
        <label className="field">
          State where you live
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="" disabled>Choose a state</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="field">
          Value of what you own, before debts: {usd(value)}
          <input
            type="range"
            min={50_000}
            max={5_000_000}
            step={25_000}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-valuetext={usd(value)}
          />
        </label>
        <p className="notice">
          Include your home, savings and investments. Leave out accounts that already name a beneficiary, like
          retirement accounts and life insurance, because those usually skip probate.
        </p>
        <label className="field">
          Other states where you own real estate
          <select value={otherStates} onChange={(e) => setOtherStates(Number(e.target.value))}>
            {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 3 ? "3 or more" : n}</option>)}
          </select>
        </label>
      </div>

      {estimate && (
        <div className="result" aria-live="polite">
          <p style={{ margin: 0 }}>Estimated probate costs without a funded trust</p>
          <div className="big">{usd(estimate.probateCost.low)} to {usd(estimate.probateCost.high)}</div>
          <p>
            About {estimate.probatePercent.low}% to {estimate.probatePercent.high}% of the estate, and often{" "}
            {estimate.durationMonths.low} to {estimate.durationMonths.high} months before family receives everything.
          </p>
          <ul>
            {estimate.notes.map((n) => <li key={n} className="notice">{n}</li>)}
          </ul>
          <p className="notice">
            A trust-based plan costs more to set up than a will, and only avoids probate for property moved into it.{" "}
            {fee ? `Our flat fee for a trust-based plan is ${usd(fee.low)} to ${usd(fee.high)}.` : "Ask us for a flat-fee quote."}
          </p>
        </div>
      )}

      <ProbateVsTrustAnimation />

      {estimate && !done && (
        <LeadForm
          tool="cost_calculator"
          resource={GUIDE}
          result={{
            estateValue: value,
            estimateState: state,
            otherStatesWithProperty: otherStates,
            probateLow: estimate.probateCost.low,
            probateHigh: estimate.probateCost.high,
          }}
          legend="Get the free probate vs. trust guide"
          why="A plain-English comparison of costs, timelines and privacy, plus a copy of your estimate."
          submitLabel="Send me the guide"
          onSuccess={setDone}
        />
      )}
      {done && (
        <div className="result">
          <strong>Thank you.</strong>{" "}
          {done.guideUrl ? <>Your guide is ready: <Link href={done.guideUrl}>open the probate vs. trust guide</Link>.</> : null}{" "}
          {done.served ? "Someone from our intake team may reach out to see if you have questions." : ""}
        </div>
      )}
      <p className="notice">
        Estimates use general published ranges and, in California, the statutory fee schedule. They are not a quote and
        not legal advice. Actual costs depend on the estate, the court and whether anyone contests.
      </p>
    </>
  );
}
