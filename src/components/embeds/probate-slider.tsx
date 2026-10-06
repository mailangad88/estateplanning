"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { US_STATES } from "@/config/firm";
import { estimateProbate } from "@/lib/tools/costEstimate";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** A one-slider version of the probate cost estimator, with a bar that shows the share of the estate. */
export function ProbateSlider({ id, defaultState }: { id: string; defaultState: string }) {
  const [value, setValue] = useState(500_000);
  const [state, setState] = useState(defaultState);
  const e = useMemo(() => estimateProbate({ estateValue: value, state, otherStatesWithProperty: 0 }), [value, state]);
  const lowPct = Math.min(100, (e.probateCost.low / value) * 100);
  const highPct = Math.min(100, (e.probateCost.high / value) * 100);
  return (
    <div className="vk-slider">
      <div className="vk-slider__inputs">
        <label className="vk-slider__field" htmlFor={`${id}-v`}>
          <span>What you own, outside accounts with beneficiaries</span>
          <strong>{usd(value)}</strong>
          <input id={`${id}-v`} type="range" min={50_000} max={3_000_000} step={25_000} value={value} onChange={(ev) => setValue(Number(ev.target.value))} aria-valuetext={usd(value)} />
        </label>
        <label className="vk-slider__state" htmlFor={`${id}-s`}>
          <span>State</span>
          <select id={`${id}-s`} value={state} onChange={(ev) => setState(ev.target.value)}>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="vk-slider__out" aria-live="polite">
        <p className="vk-slider__big">{usd(e.probateCost.low)} to {usd(e.probateCost.high)}</p>
        <p className="vk-slider__sub">A rough range of what probate could cost, before any trust or other planning.</p>
        <div className="vk-bar" role="img" aria-label={`About ${lowPct.toFixed(1)} to ${highPct.toFixed(1)} percent of the estate`}>
          <span className="vk-bar__low" style={{ width: `${Math.max(lowPct, 0.6)}%` }} />
          <span className="vk-bar__high" style={{ width: `${Math.max(highPct - lowPct, 0.6)}%` }} />
        </div>
        <p className="vk-slider__note">{e.notes[0]} Educational only, not a quote.</p>
        <Link href="/tools/probate-cost-estimator" className="arrow-link">
          Full estimate, with time and out-of-state property <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
