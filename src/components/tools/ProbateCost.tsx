"use client";

import { useState } from "react";
import { EmailCapture } from "@/components/capture";
import { Money, Num, usd } from "./shared";

export function estimateProbate(i: { probateAssets: number; attorneyPctLow: number; attorneyPctHigh: number; executorPct: number; courtFees: number; otherCosts: number }) {
  const low = i.probateAssets * (i.attorneyPctLow / 100) + i.courtFees + i.otherCosts;
  const high = i.probateAssets * (i.attorneyPctHigh / 100) + i.probateAssets * (i.executorPct / 100) + i.courtFees + i.otherCosts;
  return { low: Math.round(low), high: Math.round(high) };
}

export default function ProbateCost() {
  const [probateAssets, setProbateAssets] = useState(600_000);
  const [attorneyPctLow, setLow] = useState(2);
  const [attorneyPctHigh, setHigh] = useState(5);
  const [executorPct, setExecutor] = useState(2);
  const [courtFees, setCourt] = useState(1_000);
  const [otherCosts, setOther] = useState(3_000);
  const r = estimateProbate({ probateAssets, attorneyPctLow, attorneyPctHigh, executorPct, courtFees, otherCosts });
  return (
    <>
      <div className="tool">
        <div className="row">
          <Money label="Value of assets that would go through probate" value={probateAssets} onChange={setProbateAssets} help="Leave out accounts with beneficiaries, joint property and trust assets" />
          <Money label="Court filing and publication fees" value={courtFees} onChange={setCourt} />
          <Money label="Appraisals, bond, accounting, other" value={otherCosts} onChange={setOther} />
        </div>
        <div className="row">
          <Num label="Attorney fees, low" suffix="% of probate assets" value={attorneyPctLow} onChange={setLow} step={0.5} />
          <Num label="Attorney fees, high" suffix="% of probate assets" value={attorneyPctHigh} onChange={setHigh} step={0.5} />
          <Num label="Executor fee if taken" suffix="%" value={executorPct} onChange={setExecutor} step={0.5} />
        </div>
        <div className="result" aria-live="polite">
          <p className="big">{usd(r.low)} to {usd(r.high)}</p>
          <p className="notice">
            The percentages are illustrative assumptions you can change, not quotes. Some states set probate fees by statute;
            many attorneys bill hourly or a flat fee instead. Time matters too: probate commonly takes months, sometimes more than a year.
          </p>
        </div>
      </div>
      <EmailCapture
        kind="report"
        interest="tool:probate-cost-estimator"
        title="Want to know how your family could skip probate?"
        body="We'll email your estimate and a short guide to the common ways families keep assets out of probate."
        details={{ probateAssets, low: r.low, high: r.high }}
      />
    </>
  );
}
