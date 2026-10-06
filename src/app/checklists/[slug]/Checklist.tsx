"use client";

import { useEffect, useState } from "react";
import { track } from "@/components/capture";

export default function ChecklistView({ slug, sections }: { slug: string; sections: { heading: string; items: string[] }[] }) {
  const key = `efp-checklist-${slug}`;
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(key) ?? "{}"));
    } catch {}
  }, [key]);
  function toggle(id: string) {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const count = Object.values(done).filter(Boolean).length;
  return (
    <div className="checklist">
      <div className="no-print" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div className="bar" style={{ flex: 1, minWidth: 160 }} aria-hidden="true"><span style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div>
        <span className="notice">{count} of {total} done</span>
        <button className="button secondary" type="button" onClick={() => { track("checklist_print", { slug }); window.print(); }}>Print</button>
      </div>
      {sections.map((s, si) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          <ul>
            {s.items.map((item, ii) => {
              const id = `${si}-${ii}`;
              return (
                <li key={id}>
                  <label>
                    <input type="checkbox" checked={!!done[id]} onChange={() => toggle(id)} />
                    <span>{item}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
