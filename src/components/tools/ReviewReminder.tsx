"use client";

import { useState } from "react";
import { EmailCapture } from "@/components/capture";
import { YesNo } from "./shared";

const EVENTS = [
  ["marriage", "Married, divorced or separated"],
  ["child", "Had or adopted a child, or a grandchild"],
  ["move", "Moved to a different state"],
  ["death", "Someone named in the plan died or became unable to serve"],
  ["home", "Bought or sold a home"],
  ["money", "Wealth changed a lot (up or down)"],
  ["business", "Started or sold a business"],
  ["health", "A serious health diagnosis in the family"],
] as const;

export function reviewStatus(signedYear: number, events: string[], now = new Date().getFullYear()) {
  const age = now - signedYear;
  if (events.length > 0) return { status: "Review now", reason: "A life change since signing can make parts of the plan wrong or ineffective." };
  if (age >= 5) return { status: "Review now", reason: `Your plan is ${age} years old. Laws and family circumstances usually change in that time.` };
  if (age >= 3) return { status: "Review soon", reason: `Your plan is ${age} years old. A light review every 3 to 5 years is common.` };
  return { status: "Up to date", reason: "No major changes. Set a reminder so it stays that way." };
}

export default function ReviewReminder() {
  const year = new Date().getFullYear();
  const [signed, setSigned] = useState(year - 6);
  const [ev, setEv] = useState<string[]>([]);
  const r = reviewStatus(signed, ev, year);
  return (
    <>
      <div className="tool">
        <label className="field">Year your will or trust was signed<input type="number" value={signed} min={1950} max={year} onChange={(e) => setSigned(Number(e.target.value))} /></label>
        <p><strong>Since then, have you:</strong></p>
        {EVENTS.map(([k, label]) => (
          <YesNo key={k} label={label} value={ev.includes(k)} onChange={(v) => setEv(v ? [...ev, k] : ev.filter((x) => x !== k))} />
        ))}
        <div className="result" aria-live="polite">
          <p className="big">{r.status}</p>
          <p>{r.reason}</p>
        </div>
      </div>
      <EmailCapture kind="newsletter" interest="tool:plan-review-reminder" title="Send me a yearly review reminder" body="One email a year with a 5-minute checklist. Nothing else unless you ask." cta="Remind me yearly" details={{ signedYear: signed, events: ev.join(",") }} />
    </>
  );
}
