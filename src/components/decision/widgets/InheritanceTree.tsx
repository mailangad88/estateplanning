"use client";

import { useState } from "react";
import { FAMILY, splitEstate, type Method } from "@/lib/inheritance";

const TOTAL = 300000;
const TONES: Record<string, string> = { ann: "accent", ben: "sage", cara: "gold" };
const METHODS: { id: Method; label: string; text: string }[] = [
  {
    id: "stirpes",
    label: "Per stirpes",
    text: "Each child's branch keeps its share. If a child died first, that child's children split what their parent would have received.",
  },
  {
    id: "capita",
    label: "Per capita",
    text: "As most beneficiary forms use it: equal shares to the children who are still alive. A child who died first is skipped, and so are that child's children.",
  },
  {
    id: "generation",
    label: "Per capita at each generation",
    text: "Living children take one share each. The shares of children who died first are pooled and split equally among all of their children, so every grandchild in that group gets the same amount.",
  },
];

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Family-tree calculator for per stirpes and per capita. One fixed family, so the numbers match the
 * worked examples in the per stirpes guide. Tap a method or mark a child as having died first.
 */
export function InheritanceTree() {
  const [method, setMethod] = useState<Method>("stirpes");
  const [died, setDied] = useState<Set<string>>(new Set(["ben"]));
  const shares = splitEstate(TOTAL, method, died);
  const m = METHODS.find((x) => x.id === method)!;
  const toggle = (id: string) =>
    setDied((d) => {
      const n = new Set(d);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const branchOf = (id: string) => FAMILY.grandchildren.find((g) => g.id === id)?.parent ?? id;
  const slices = Object.entries(shares).map(([id, v]) => ({ id, v, tone: TONES[branchOf(id)] }));

  return (
    <figure className="dg-tree">
      <figcaption>
        <strong>Try it: who gets your {money(TOTAL)}?</strong> You have three children. Ben has two children and Cara has one.
      </figcaption>
      <div className="dg-filter" role="group" aria-label="How the estate is divided">
        {METHODS.map((x) => (
          <button type="button" key={x.id} aria-pressed={method === x.id} onClick={() => setMethod(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="dg-tree__toggles">
        {["ben", "cara"].map((id) => (
          <label key={id} className="dg-tree__toggle">
            <input type="checkbox" checked={died.has(id)} onChange={() => toggle(id)} />
            {FAMILY.children.find((c) => c.id === id)!.name} died before you
          </label>
        ))}
      </div>
      <p className="dg-tree__rule">{m.text}</p>

      <div className="dg-tree__chart" aria-live="polite">
        <div className="dg-tree__root">You leave {money(TOTAL)}</div>
        <ol className="dg-tree__kids">
          {FAMILY.children.map((c) => {
            const gone = died.has(c.id);
            const kids = FAMILY.grandchildren.filter((g) => g.parent === c.id);
            return (
              <li key={c.id} className={`dg-tree__branch dg-tone--${TONES[c.id]}`}>
                <Node name={c.name} amount={shares[c.id]} gone={gone} />
                {kids.length > 0 && (
                  <ol className="dg-tree__grand">
                    {kids.map((g) => (
                      <li key={g.id}>
                        <Node name={g.name} amount={shares[g.id]} small />
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="dg-tree__bar" aria-hidden="true">
        {slices.map((s) => (
          <span key={s.id} className={`dg-tone--${s.tone}`} style={{ flexGrow: s.v }}>
            {FAMILY.children.concat(FAMILY.grandchildren).find((p) => p.id === s.id)?.name}
          </span>
        ))}
      </div>
      <p className="dg-tree__note">
        Illustration only. What a word like &quot;per capita&quot; means depends on how your will, trust or beneficiary form defines it, and
        state law fills any gap.
      </p>
    </figure>
  );
}

function Node({ name, amount, gone, small }: { name: string; amount?: number; gone?: boolean; small?: boolean }) {
  return (
    <div className={`dg-tree__node${gone ? " is-gone" : ""}${small ? " is-small" : ""}${amount ? " is-paid" : ""}`}>
      <span className="dg-tree__name">{name}</span>
      <span className="dg-tree__amt">{gone ? "Died before you" : amount ? money(amount) : "$0"}</span>
    </div>
  );
}
