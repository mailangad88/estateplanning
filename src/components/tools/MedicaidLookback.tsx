"use client";

import { useState } from "react";
import { FIGURES } from "@/config/figures";
import { EmailCapture } from "@/components/capture";

export function lookbackStart(applicationDate: string, months = FIGURES.medicaidLookbackMonths): string {
  const [y, m, d] = applicationDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export default function MedicaidLookback() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const start = date ? lookbackStart(date) : "";
  return (
    <>
      <div className="tool">
        <label className="field">Expected Medicaid application date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {start && (
          <div className="result" aria-live="polite">
            <p className="big">Look-back starts {start}</p>
            <p className="notice">
              Gifts or transfers for less than fair value made on or after this date may be reviewed and can delay nursing home
              coverage. Most states use {FIGURES.medicaidLookbackMonths} months; California and a few others differ. Rules are
              complex and change, so talk to an elder law attorney before moving assets.
            </p>
          </div>
        )}
      </div>
      <EmailCapture kind="report" interest="tool:medicaid-lookback-date" title="Planning care for a parent?" body="We'll email a short guide to long-term care planning and what to do before an application." askPhone details={{ applicationDate: date }} />
    </>
  );
}
