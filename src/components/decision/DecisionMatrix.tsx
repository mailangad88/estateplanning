"use client";

import { useState } from "react";
import type { DecisionGuide, Level } from "@/config/decisions/types";
import { iconFor } from "./icons";

const LEVEL_WORDS = ["none", "a little", "partly", "fully"];

function Meter({ level, inverse }: { level: Level; inverse?: boolean }) {
  return (
    <span className={`dg-meter dg-meter--${level}${inverse ? " is-inverse" : ""}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

/**
 * Every option against every dimension. Rows are options so the table stays readable with many of
 * them; the first column sticks while the rest scroll sideways on phones. Family chips filter rows.
 */
export function DecisionMatrix({ guide, anchorBase = "" }: { guide: DecisionGuide; anchorBase?: string }) {
  const [family, setFamily] = useState<string>("all");
  const rows = guide.options.filter((o) => family === "all" || o.family === family);
  const tone = (id: string) => guide.families.find((f) => f.id === id)?.tone ?? "accent";
  return (
    <div className="dg-matrix">
      <div className="dg-filter" role="group" aria-label={`Filter ${guide.noun} options`}>
        <button type="button" aria-pressed={family === "all"} onClick={() => setFamily("all")}>
          All {guide.options.length}
        </button>
        {guide.families.map((f) => (
          <button type="button" key={f.id} aria-pressed={family === f.id} className={`dg-tone--${f.tone}`} onClick={() => setFamily(f.id)}>
            {f.name}
          </button>
        ))}
      </div>
      <div className="dg-table-wrap" tabIndex={0} role="region" aria-label={`Comparison table of ${guide.noun} options`}>
        <table className="dg-table">
          <caption className="sr-only">
            Each option compared on {guide.dimensions.map((d) => d.label.toLowerCase()).join(", ")}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Type</th>
              {guide.dimensions.map((d) => (
                <th scope="col" key={d.id}>
                  {d.label}
                  {d.help && <span className="dg-table__help">{d.help}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const Icon = iconFor(o.icon);
              return (
                <tr key={o.id}>
                  <th scope="row">
                    <a href={`${anchorBase}#opt-${o.id}`} className="dg-rowhead">
                      <span className={`dg-icon dg-tone--${tone(o.family)}`}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      {o.name}
                    </a>
                  </th>
                  {guide.dimensions.map((d) => {
                    const cell = o.cells[d.id];
                    return (
                      <td key={d.id}>
                        {cell && (
                          <>
                            <Meter level={cell.level} inverse={d.inverse} />
                            <span className="sr-only">{LEVEL_WORDS[cell.level]}: </span>
                            <span className="dg-cell">{cell.text}</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="dg-legend">
        <Meter level={3} /> fully <Meter level={2} /> partly <Meter level={1} /> a little <Meter level={0} /> no. Clay dots mark cost and paperwork, where more means more work.
      </p>
    </div>
  );
}
