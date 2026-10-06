"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { EmailCapture, track } from "@/components/capture";
import "@/components/decision/decision.css";
import { Money, usd } from "./shared";
import { STATE_NAMES, stateName } from "@/lib/tools/smallEstate";
import {
  ASSET_KINDS, ASSET_SORTER_DISCLAIMER, TRAPS, compareIllinoisAffidavit, holdingLabel, sortAssets,
  type AssetInput, type AssetKind, type BeneficiaryStatus, type Holding, type JointPurpose, type SortedAsset,
} from "@/lib/tools/assetSorter";

const SLUG = "probate-asset-sorter";
export const meta = { slug: SLUG, title: "Which of my assets go through probate?" };

const KINDS = Object.keys(ASSET_KINDS) as AssetKind[];
const BENEFICIARY: [BeneficiaryStatus, string][] = [
  ["person", "A living person (and I am fairly sure it is current)"],
  ["estate", "My estate"],
  ["deceased", "Someone who has died, with no backup named"],
  ["unsure", "I am not sure"],
];

let seq = 0;
const blank = (kind: AssetKind): AssetInput => ({
  id: `a${++seq}`, kind, value: 0, holding: ASSET_KINDS[kind].holdings[0], beneficiary: "person", jointPurpose: "co_owner",
});

function Chip({ a, tone }: { a: SortedAsset; tone: "clay" | "sage" }) {
  return (
    <li className={`dg-chip dg-tone--${tone}`}>
      <span>
        {a.label}
        <span>{a.value ? usd(a.value) : "no value entered"}</span>
      </span>
    </li>
  );
}

export default function AssetSorter({ initialState }: { initialState?: string }) {
  const [state, setState] = useState(initialState && STATE_NAMES[initialState.toUpperCase()] ? initialState.toUpperCase() : "IL");
  const [assets, setAssets] = useState<AssetInput[]>([]);
  const [shown, setShown] = useState(false);
  const started = useRef(false);
  const completed = useRef(false);

  const start = () => { if (!started.current) { started.current = true; track("tool_start", { tool_id: SLUG }); } };
  const add = (k: AssetKind) => { start(); setAssets((xs) => [...xs, blank(k)]); setShown(false); };
  const patch = (id: string, p: Partial<AssetInput>) => { start(); setAssets((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))); };
  const remove = (id: string) => setAssets((xs) => xs.filter((x) => x.id !== id));

  const result = sortAssets(assets);
  const il = compareIllinoisAffidavit(result, state, new Date());
  const idLabel = (id: string) => { const a = assets.find((x) => x.id === id); return a ? ASSET_KINDS[a.kind].label : ""; };

  const showResult = () => {
    setShown(true);
    if (!completed.current) { completed.current = true; track("tool_complete", { tool_id: SLUG }); }
  };

  return (
    <>
      <div className="tool">
        <p className="notice">Nothing you type here leaves this browser tab unless you ask for an email. Approximate values are fine.</p>

        <label className="field">
          Your state
          <select value={state} onChange={(e) => setState(e.target.value)}>
            {Object.entries(STATE_NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </label>

        <fieldset className="question">
          <legend>Add your assets</legend>
          <div className="dg-filter">
            {KINDS.map((k) => (
              <button key={k} type="button" onClick={() => add(k)}>+ {ASSET_KINDS[k].label}</button>
            ))}
          </div>
        </fieldset>

        {assets.map((a, i) => {
          const info = ASSET_KINDS[a.kind];
          return (
            <div className="card" key={a.id}>
              <div className="row">
                <Money label={`${info.label} (${i + 1}): approximate value`} value={a.value} onChange={(n) => patch(a.id, { value: n })} />
                <label className="field">
                  How is it held?
                  <select value={a.holding} onChange={(e) => patch(a.id, { holding: e.target.value as Holding })}>
                    {info.holdings.map((h) => <option key={h} value={h}>{holdingLabel(a.kind, h)}</option>)}
                  </select>
                </label>
                {a.holding === "beneficiary" && (
                  <label className="field">
                    Who is the beneficiary?
                    <select value={a.beneficiary} onChange={(e) => patch(a.id, { beneficiary: e.target.value as BeneficiaryStatus })}>
                      {BENEFICIARY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                )}
                {(a.holding === "jtwros" || a.holding === "tbe") && (
                  <label className="field">
                    Why is the other person on it?
                    <select value={a.jointPurpose} onChange={(e) => patch(a.id, { jointPurpose: e.target.value as JointPurpose })}>
                      <option value="co_owner">They really co-own it (spouse or partner)</option>
                      <option value="convenience">I added them to help pay bills or manage it</option>
                    </select>
                  </label>
                )}
              </div>
              <button type="button" className="button secondary small" onClick={() => remove(a.id)}>Remove {info.label.toLowerCase()} {i + 1}</button>
            </div>
          );
        })}

        <button type="button" className="button" disabled={assets.length === 0} onClick={showResult}>
          Sort my assets
        </button>
        {assets.length === 0 && <p className="notice">Add at least one asset above to see the sort.</p>}
      </div>

      {shown && assets.length > 0 && (
        <>
          <div className="dg-result" aria-live="polite">
            <h3>
              {result.total > 0
                ? `About ${result.probateShare}% of what you listed (${usd(result.probateTotal)}) would go through probate.`
                : `${result.probate.length} of ${assets.length} assets would go through probate.`}
            </h3>

            <figure className="dg-bars">
              <figcaption>Where the value goes</figcaption>
              <div
                className="dg-bars__track"
                style={{ display: "flex", height: 22 }}
                role="img"
                aria-label={`Probate ${usd(result.probateTotal)}, ${result.probateShare} percent. Outside probate ${usd(result.outsideTotal)}, ${result.outsideShare} percent.`}
              >
                <span className="dg-bars__fill dg-tone--clay" style={{ width: `${result.probateShare}%` }} />
                <span className="dg-bars__fill dg-tone--sage" style={{ width: `${result.outsideShare}%` }} />
              </div>
              <p className="notice" style={{ marginBottom: 0 }}>
                <span className="dg-swatch dg-tone--clay">Probate {usd(result.probateTotal)}</span>{" "}
                <span className="dg-swatch dg-tone--sage">Outside probate {usd(result.outsideTotal)}</span>
              </p>
            </figure>

            <div className="row" style={{ marginTop: 18 }}>
              <section aria-labelledby="as-probate" className="card dg-tone--clay">
                <h4 id="as-probate" style={{ margin: "0 0 8px" }}>Goes through probate ({result.probate.length})</h4>
                {result.probate.length ? <ul className="dg-also" style={{ listStyle: "none", padding: 0, display: "grid", gap: 8, margin: 0 }}>{result.probate.map((a) => <Chip key={a.id} a={a} tone="clay" />)}</ul> : <p>Nothing on your list.</p>}
              </section>
              <section aria-labelledby="as-outside" className="card dg-tone--sage">
                <h4 id="as-outside" style={{ margin: "0 0 8px" }}>Passes outside probate ({result.outside.length})</h4>
                {result.outside.length ? <ul className="dg-also" style={{ listStyle: "none", padding: 0, display: "grid", gap: 8, margin: 0 }}>{result.outside.map((a) => <Chip key={a.id} a={a} tone="sage" />)}</ul> : <p>Nothing on your list.</p>}
              </section>
            </div>
          </div>

          <h3>Why each asset landed where it did</h3>
          <ul className="dg-ticks">
            {[...result.probate, ...result.outside].map((a) => (
              <li key={a.id} className={a.bucket === "probate" ? "dg-ticks--warn" : undefined}>
                {a.bucket === "probate" ? <TriangleAlert size={18} aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}
                <span><strong>{a.label} ({holdingLabel(a.kind, a.holding)}):</strong> {a.why}</span>
              </li>
            ))}
          </ul>

          {result.traps.length > 0 && (
            <div className="dg-note">
              <strong>Common traps to check</strong>
              <ul>
                {result.traps.map((t) => (
                  <li key={t.code}>
                    <strong>{TRAPS[t.code].title}</strong> ({[...new Set(t.assetIds.map(idLabel))].join(", ")}). {TRAPS[t.code].text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state === "IL" && il ? (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Illinois small estate affidavit check</h3>
              {il.cap === null ? (
                <p>We cannot show the current Illinois dollar limit right now because the figure we hold is out of date. See the <Link href="/tools/small-estate-checker?state=IL">small estate checker</Link>.</p>
              ) : (
                <>
                  <p>
                    The affidavit covers personal property only, not real estate, and motor vehicles are left out of the count. The limit is {usd(il.cap)} for deaths on or after Aug 15, 2025.
                    Your probate personal property that counts: <strong>{usd(il.counted)}</strong>.
                  </p>
                  <div className="dg-bars__track" style={{ height: 14 }} role="img" aria-label={`${usd(il.counted)} counted against a limit of ${usd(il.cap)}`}>
                    <span className="dg-bars__fill dg-tone--accent" style={{ width: `${Math.min(100, (il.counted / il.cap) * 100)}%` }} />
                  </div>
                  <p className="notice">Vehicles left out: {usd(il.vehiclesLeftOut)}. Real estate in probate: {usd(il.realEstateInProbate)}.</p>
                  <p>
                    {il.verdict === "nothing_in_probate" && "Nothing on your list would need probate, so no affidavit would be needed for these assets."}
                    {il.verdict === "under_cap" && "On these numbers, the probate part would be under the limit, so the affidavit may be an option instead of a full court case."}
                    {il.verdict === "real_estate_needs_other_route" && "The personal property is under the limit, but real estate in probate cannot pass by affidavit. It would need another court route."}
                    {il.verdict === "over_cap" && "On these numbers, the probate personal property is over the limit, so the affidavit would likely not be available."}
                  </p>
                  <p className="notice">Source: {il.statuteCite}, checked {il.asOf}. Values at death will differ from today&apos;s, and the institution holding each asset decides what it accepts.</p>
                </>
              )}
            </div>
          ) : (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Small estate shortcuts in {stateName(state)}</h3>
              <p>Many states let a small probate estate skip full probate. Use the <Link href={`/tools/small-estate-checker?state=${state}`}>small estate checker</Link> to see whether your probate bucket might qualify.</p>
            </div>
          )}

          <EmailCapture
            kind="report"
            interest={`tool:${SLUG}`}
            title="Email me this sort as a printable sheet"
            body="We will send the two buckets, the traps to check, and a short list of forms to review. Only counts and categories are used, not your figures. No sales emails."
            details={{ assets: assets.length, probateCount: result.probate.length, probateSharePct: result.probateShare, traps: result.traps.length, state }}
          />

          <h3>What to read next</h3>
          <ul>
            <li><Link href="/guides/how-probate-works">How probate works</Link></li>
            <li><Link href="/guides/beneficiary-designations">Beneficiary designations</Link></li>
            <li><Link href="/learn/beneficiary-designations/payable-on-death-and-transfer-on-death-accounts">Transfer on death and payable on death</Link></li>
            <li><Link href="/guides/funding-your-trust">Funding your trust</Link></li>
            <li><Link href="/tools/beneficiary-audit">Beneficiary audit</Link></li>
          </ul>
          <p className="notice">{ASSET_SORTER_DISCLAIMER} Not sure where to start? Try the <Link href="/plan-finder">plan finder</Link>.</p>
        </>
      )}
    </>
  );
}
