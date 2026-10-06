"use client";

import Link from "next/link";
import "@/components/decision/decision.css";
import { useRef, useState } from "react";
import { EmailCapture, track } from "@/components/capture";
import { STATE_NAMES } from "@/lib/tools/smallEstate";
import {
  BEYOND_THIS_TOOL,
  GUIDE_PATH,
  ILLINOIS_RULE,
  MAX_COUNT,
  WHO_INHERITS_DISCLAIMER,
  WILL_CHANGES,
  fracPercent,
  fracText,
  isSupported,
  whoInherits,
  type Family,
  type Heir,
  type InheritResult,
} from "@/lib/tools/whoInherits";

const SLUG = "who-inherits";
export const meta = { slug: SLUG, title: "Who inherits if there is no will?" };

const TONE: Record<Heir["group"], string> = { spouse: "accent", descendant: "sage", parent: "gold", sibling: "clay" };
const GROUP_NAME: Record<Heir["group"], string> = { spouse: "Spouse", descendant: "Children and grandchildren", parent: "Parents", sibling: "Siblings and their children" };
const range = Array.from({ length: MAX_COUNT + 1 }, (_, i) => i);

function Count({ label, help, value, onChange, min = 0 }: { label: string; help?: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <label className="field">
      {label}
      {help && <span className="dg-q__help">{help}</span>}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {range.filter((n) => n >= min).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}

function resize(list: number[], n: number): number[] {
  return Array.from({ length: n }, (_, i) => list[i] ?? 1);
}

/** Family tree drawn with SVG. Colours come from design tokens. */
function Tree({ r }: { r: InheritResult }) {
  const W = 104;
  const top = r.heirs.filter((h) => !h.parentId);
  const nodes: { id: string; label: string; share: string; group: Heir["group"]; gone: boolean; kids: Heir[] }[] = [
    ...top.map((h) => ({ id: h.id, label: h.label, share: fracText(h.share), group: h.group, gone: false, kids: [] as Heir[] })),
    ...r.placeholders.map((p) => ({
      id: p.id, label: p.label.replace(/ \d+$/, ""), share: fracText(p.share), group: p.group, gone: true,
      kids: r.heirs.filter((h) => h.parentId === p.id),
    })),
  ];
  const order = { spouse: 0, parent: 1, descendant: 2, sibling: 3 } as const;
  nodes.sort((a, b) => order[a.group] - order[b.group]);
  let x = 0;
  const placed = nodes.map((n) => {
    const span = Math.max(1, n.kids.length);
    const cx = (x + span / 2) * W;
    const out = { ...n, cx, start: x };
    x += span;
    return out;
  });
  const width = Math.max(x, 2) * W;
  const rootX = width / 2;
  const hasKids = placed.some((n) => n.kids.length);
  const height = hasKids ? 330 : 230;
  const fill = (g: Heir["group"]) => `var(--${TONE[g] === "accent" ? "brand" : TONE[g] === "clay" ? "clay" : TONE[g]}-tint)`;
  const stroke = (g: Heir["group"]) => `var(--${TONE[g] === "accent" ? "brand" : TONE[g] === "clay" ? "cta" : TONE[g]})`;
  const summary = r.heirs.map((h) => `${h.label} ${fracText(h.share)}`).join(", ") || "no close relatives";
  return (
    <div style={{ overflowX: "auto" }}>
      <svg role="img" aria-labelledby="wi-t wi-d" viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: Math.min(width, 520), height: "auto", display: "block" }}>
        <title id="wi-t">Family tree showing who inherits</title>
        <desc id="wi-d">{summary}</desc>
        <rect x={rootX - 52} y={8} width={104} height={46} rx={14} style={{ fill: "var(--brand-deep)" }} />
        <text x={rootX} y={36} textAnchor="middle" fontSize={14} fontWeight={700} style={{ fill: "var(--on-dark)" }}>You</text>
        {placed.map((n) => (
          <g key={n.id}>
            <path d={`M${rootX} 54 V84 H${n.cx} V110`} fill="none" strokeWidth={2} style={{ stroke: "var(--border)" }} />
            <rect x={n.cx - 46} y={110} width={92} height={58} rx={12} strokeWidth={2} strokeDasharray={n.gone ? "5 4" : undefined} style={{ fill: fill(n.group), stroke: stroke(n.group) }} />
            <text x={n.cx} y={132} textAnchor="middle" fontSize={11.5} fontWeight={600} style={{ fill: "var(--text)" }}>{n.label.length > 14 ? n.label.slice(0, 13) + "." : n.label}</text>
            <text x={n.cx} y={156} textAnchor="middle" fontSize={17} fontWeight={700} style={{ fill: "var(--text)" }}>{n.gone ? `(${n.share})` : n.share}</text>
            {n.kids.map((k, i) => {
              const kx = (n.start + i + 0.5) * W;
              return (
                <g key={k.id}>
                  <path d={`M${n.cx} 168 V190 H${kx} V210`} fill="none" strokeWidth={2} style={{ stroke: "var(--border)" }} />
                  <rect x={kx - 42} y={210} width={84} height={58} rx={12} strokeWidth={2} style={{ fill: fill(n.group), stroke: stroke(n.group) }} />
                  <text x={kx} y={229} textAnchor="middle" fontSize={10.5} fontWeight={600} style={{ fill: "var(--text)" }}>{k.label.length > 14 ? k.label.slice(0, 13) + "." : k.label}</text>
                  <text x={kx} y={254} textAnchor="middle" fontSize={16} fontWeight={700} style={{ fill: "var(--text)" }}>{fracText(k.share)}</text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      {placed.some((n) => n.gone) && <p className="dg-q__help">Dashed boxes are family members who died before you. Their share goes to their own children.</p>}
    </div>
  );
}

function Bars({ r }: { r: InheritResult }) {
  return (
    <figure className="dg-bars">
      <figcaption>Each person&apos;s share of what you own in your name</figcaption>
      <ol>
        {r.heirs.map((h) => (
          <li key={h.id} className={`dg-tone--${TONE[h.group]}`}>
            <span>{h.label}</span>
            <span className="dg-bars__track"><span className="dg-bars__fill" style={{ width: `${fracPercent(h.share)}%` }} /></span>
            <span className="dg-bars__pct">{fracText(h.share)}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export default function WhoInherits({ initialState }: { initialState?: string }) {
  const [state, setState] = useState(initialState && STATE_NAMES[initialState.toUpperCase()] ? initialState.toUpperCase() : "IL");
  const [married, setMarried] = useState<boolean | null>(null);
  const [children, setChildren] = useState(0);
  const [gone, setGone] = useState<number[]>([]);
  const [parents, setParents] = useState<0 | 1 | 2>(0);
  const [sibs, setSibs] = useState(0);
  const [goneSibs, setGoneSibs] = useState<number[]>([]);
  const started = useRef(false);
  const completed = useRef(false);
  const touch = () => {
    if (!started.current) {
      started.current = true;
      track("tool_start", { tool_id: SLUG });
    }
  };

  const supported = isSupported(state);
  const family: Family = { married: !!married, children, deceasedChildren: gone, parentsLiving: parents, siblings: sibs, deceasedSiblings: goneSibs };
  const r = supported && married !== null ? whoInherits(family) : null;
  if (r && !completed.current) {
    completed.current = true;
    track("tool_complete", { tool_id: SLUG });
  }
  const hasDesc = children + gone.length > 0;
  const groups = r ? (["spouse", "descendant", "parent", "sibling"] as const).filter((g) => r.heirs.some((h) => h.group === g)) : [];

  return (
    <>
      <div className="dg-picker">
        <label className="field">
          Which state do you live in?
          <select value={state} onChange={(e) => { touch(); setState(e.target.value); }}>
            {Object.entries(STATE_NAMES).map(([code, n]) => <option key={code} value={code}>{n}</option>)}
          </select>
        </label>

        {!supported && (
          <div className="dg-note" role="status">
            <strong>The rules differ by state.</strong> This tool shows the Illinois rules only, so the Illinois answer is not yours. Who inherits without a will depends on your state&apos;s law, and we do not guess at it here. Start with{" "}
            <Link href={GUIDE_PATH}>what happens if you die without a will</Link>, or choose Illinois above to see how the picture works.
          </div>
        )}

        {supported && (
          <>
            <fieldset className="dg-q" style={{ marginTop: 20 }}>
              <legend><h3>Are you married?</h3><span className="dg-q__help">Married and not divorced. An unmarried partner does not inherit without a will.</span></legend>
              <div className="dg-choices">
                {([[true, "Yes, married"], [false, "No (single, divorced, widowed or partnered)"]] as const).map(([v, l]) => (
                  <button key={String(v)} type="button" className={`dg-choice${married === v ? " is-on" : ""}`} aria-pressed={married === v} onClick={() => { touch(); setMarried(v); }}>{l}</button>
                ))}
              </div>
            </fieldset>

            <fieldset className="dg-q" style={{ marginTop: 20 }}>
              <legend><h3>Your children</h3><span className="dg-q__help">Count all children, including those from another relationship and adopted children. Stepchildren who were not adopted are not counted.</span></legend>
              <div className="row">
                <Count label="Children who are living" value={children} onChange={(n) => { touch(); setChildren(n); }} />
                <Count label="Children who died and left children of their own" help="Each one counts as a separate branch." value={gone.length} onChange={(n) => { touch(); setGone(resize(gone, n)); }} />
              </div>
              {gone.map((g, i) => (
                <Count key={i} label={`Grandchildren from the child who died (${i + 1})`} value={g} min={1} onChange={(n) => setGone(gone.map((x, j) => (j === i ? n : x)))} />
              ))}
            </fieldset>

            {!hasDesc && (
              <>
                <fieldset className="dg-q" style={{ marginTop: 20 }}>
                  <legend><h3>Your parents</h3></legend>
                  <div className="dg-choices">
                    {([[2, "Both living"], [1, "One living"], [0, "Neither living"]] as const).map(([v, l]) => (
                      <button key={v} type="button" className={`dg-choice${parents === v ? " is-on" : ""}`} aria-pressed={parents === v} onClick={() => { touch(); setParents(v); }}>{l}</button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="dg-q" style={{ marginTop: 20 }}>
                  <legend><h3>Your brothers and sisters</h3></legend>
                  <div className="row">
                    <Count label="Living" value={sibs} onChange={(n) => { touch(); setSibs(n); }} />
                    <Count label="Died and left children of their own" value={goneSibs.length} onChange={(n) => { touch(); setGoneSibs(resize(goneSibs, n)); }} />
                  </div>
                  {goneSibs.map((g, i) => (
                    <Count key={i} label={`Nieces and nephews from the sibling who died (${i + 1})`} value={g} min={1} onChange={(n) => setGoneSibs(goneSibs.map((x, j) => (j === i ? n : x)))} />
                  ))}
                </fieldset>
              </>
            )}
            {married && hasDesc === false && <p className="dg-q__help">With a spouse and no children or grandchildren, parents and siblings are not asked about because they would not inherit.</p>}
          </>
        )}

        {r && (
          <div className="dg-result" aria-live="polite" style={{ marginTop: 24 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "1.5rem" }}>{r.headline}</h3>
            <p style={{ margin: "0 0 16px" }}>{r.rule}</p>
            {r.heirs.length > 0 && (
              <>
                <Tree r={r} />
                <Bars r={r} />
                <p className="dg-result__why">Who is in the picture</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {groups.map((g) => (
                    <span key={g} className={`dg-chip dg-tone--${TONE[g]}`}><strong>{GROUP_NAME[g]}</strong></span>
                  ))}
                </div>
              </>
            )}
            <p className="dg-q__help" style={{ marginTop: 14 }}>
              Source: {ILLINOIS_RULE.cite}, checked {ILLINOIS_RULE.asOf}. Confidence: {ILLINOIS_RULE.confidence}, so please check the statute text or ask an attorney before relying on it.
            </p>
          </div>
        )}
      </div>

      {r && (
        <>
          <section className="dg-also" style={{ marginTop: 24 }}>
            <h3>What a will would change</h3>
            <ul className="dg-ticks">
              {WILL_CHANGES.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </section>
          <div className="dg-note">
            <strong>What this picture leaves out</strong>
            <ul className="dg-ticks" style={{ marginTop: 8 }}>
              {BEYOND_THIS_TOOL.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
          <EmailCapture
            kind="report"
            interest={`tool:${SLUG}`}
            title="Email me this picture"
            body="We will send your family picture and a short checklist for what a will could change. You will get no sales emails."
            cta="Send it to me"
            details={{ state, branch: r.branch }}
          />
          <p className="notice">
            Next step: see what a will could change in <Link href={GUIDE_PATH}>what happens if you die without a will</Link>, or <Link href="/plan-finder">find your plan</Link>.
          </p>
        </>
      )}
      <p className="notice">{WHO_INHERITS_DISCLAIMER}</p>
    </>
  );
}
