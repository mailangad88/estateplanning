"use client";

import { useState } from "react";
import { EmailCapture } from "@/components/capture";
import { Money, Num, usd } from "./shared";

interface Child { age: number }

export function guardianFund(children: Child[], yearlyCost: number, untilAge: number, education: number) {
  const perChild = children.map((c) => Math.max(0, untilAge - c.age) * yearlyCost + education);
  return { perChild, total: perChild.reduce((a, b) => a + b, 0) };
}

export default function GuardianFund() {
  const [kids, setKids] = useState<Child[]>([{ age: 4 }, { age: 1 }]);
  const [yearlyCost, setYearly] = useState(18_000);
  const [untilAge, setUntil] = useState(22);
  const [education, setEducation] = useState(60_000);
  const r = guardianFund(kids, yearlyCost, untilAge, education);
  return (
    <>
      <div className="tool">
        {kids.map((k, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "end" }}>
            <Num label={`Child ${i + 1} age`} value={k.age} max={25} onChange={(n) => setKids(kids.map((c, j) => (j === i ? { age: n } : c)))} />
            {kids.length > 1 && <button type="button" className="button secondary" onClick={() => setKids(kids.filter((_, j) => j !== i))} style={{ marginBottom: 14 }}>Remove</button>}
          </div>
        ))}
        <button type="button" className="button secondary" onClick={() => setKids([...kids, { age: 0 }])}>Add a child</button>
        <div className="row" style={{ marginTop: 12 }}>
          <Money label="Yearly cost to raise one child" value={yearlyCost} onChange={setYearly} />
          <Num label="Support until age" value={untilAge} onChange={setUntil} max={30} />
          <Money label="Education fund per child" value={education} onChange={setEducation} />
        </div>
        <div className="result" aria-live="polite">
          <p className="big">About {usd(r.total)}</p>
          <p className="notice">{r.perChild.map((v, i) => `Child ${i + 1}: ${usd(v)}`).join(" · ")}. Families usually fund this through life insurance and a trust for the children, so a guardian is not paying out of pocket.</p>
        </div>
      </div>
      <EmailCapture kind="report" interest="tool:guardian-fund-calculator" title="Email me the guardian worksheet" body="Our worksheet for choosing a guardian, plus your numbers." details={{ total: r.total, children: kids.length }} />
    </>
  );
}
