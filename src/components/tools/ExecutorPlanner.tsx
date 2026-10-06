"use client";

import { useState } from "react";
import { EmailCapture } from "@/components/capture";
import { YesNo } from "./shared";

const BASE = [
  "Order 10 or more certified copies of the death certificate",
  "Find the original will and any trust documents",
  "Notify Social Security and stop benefit payments",
  "Secure the home, car and valuables",
  "Forward mail and keep paying essential bills",
  "Ask an attorney whether probate is needed in your state",
  "Get an EIN and open an estate bank account if probate is opened",
  "Notify creditors as your state requires",
  "File the final personal income tax return",
  "Keep records of every payment in and out",
  "Distribute what is left and get signed receipts",
];

const EXTRA: Record<string, string[]> = {
  home: ["Keep homeowner's insurance in force and tell the insurer the home is vacant", "Get a date-of-death appraisal of the home", "Decide whether the home is sold or transferred, and handle the deed"],
  outOfState: ["Ask whether a second (ancillary) probate is needed where the other property sits"],
  retirement: ["Contact each retirement plan and insurer to start beneficiary claims"],
  business: ["Arrange who runs the business in the short term", "Review buy-sell or operating agreements"],
  trust: ["Read the trust and send required notices to beneficiaries", "Obtain a tax ID for the trust if it becomes irrevocable"],
  minorHeirs: ["Confirm how gifts to minors must be held (trust, custodian or court supervision)"],
  digital: ["Locate passwords and close or memorialize online accounts"],
  dispute: ["Talk to an attorney early: a family disagreement changes the process"],
};

export default function ExecutorPlanner() {
  const [f, setF] = useState<Record<string, boolean>>({ home: true });
  const set = (k: string) => (v: boolean) => setF({ ...f, [k]: v });
  const tasks = [...BASE, ...Object.entries(EXTRA).flatMap(([k, items]) => (f[k] ? items : []))];
  return (
    <>
      <div className="tool">
        <p><strong>What did the person own or leave behind?</strong></p>
        <YesNo label="A home or other real estate" value={!!f.home} onChange={set("home")} />
        <YesNo label="Property in another state" value={!!f.outOfState} onChange={set("outOfState")} />
        <YesNo label="Retirement accounts or life insurance" value={!!f.retirement} onChange={set("retirement")} />
        <YesNo label="A business" value={!!f.business} onChange={set("business")} />
        <YesNo label="A trust" value={!!f.trust} onChange={set("trust")} />
        <YesNo label="Heirs under 18" value={!!f.minorHeirs} onChange={set("minorHeirs")} />
        <YesNo label="Significant online accounts" value={!!f.digital} onChange={set("digital")} />
        <YesNo label="Family members who disagree" value={!!f.dispute} onChange={set("dispute")} />
        <div className="result">
          <p className="big">{tasks.length} tasks</p>
          <ol>{tasks.map((t) => <li key={t}>{t}</li>)}</ol>
        </div>
      </div>
      <EmailCapture kind="report" interest="tool:executor-workload" title="Email me this task list" body="Your personal list, plus our first-30-days checklist." askPhone details={{ tasks: tasks.length }} />
    </>
  );
}
