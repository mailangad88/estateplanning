"use client";

import { useState } from "react";
import { EmailCapture } from "@/components/capture";
import { Money, Num, usd } from "./shared";

export function insuranceNeed(i: { debts: number; income: number; years: number; mortgage: number; education: number; savings: number; existing: number }) {
  const need = i.debts + i.income * i.years + i.mortgage + i.education;
  return { need, gap: Math.max(0, need - i.savings - i.existing) };
}

export default function LifeInsurance() {
  const [debts, setDebts] = useState(25_000);
  const [income, setIncome] = useState(80_000);
  const [years, setYears] = useState(10);
  const [mortgage, setMortgage] = useState(300_000);
  const [education, setEducation] = useState(100_000);
  const [savings, setSavings] = useState(50_000);
  const [existing, setExisting] = useState(250_000);
  const r = insuranceNeed({ debts, income, years, mortgage, education, savings, existing });
  return (
    <>
      <div className="tool">
        <div className="row">
          <Money label="Debts other than the mortgage" value={debts} onChange={setDebts} />
          <Money label="Yearly income to replace" value={income} onChange={setIncome} />
          <Num label="Years of income" value={years} onChange={setYears} max={40} />
          <Money label="Mortgage balance" value={mortgage} onChange={setMortgage} />
          <Money label="Education costs for children" value={education} onChange={setEducation} />
          <Money label="Savings and investments available" value={savings} onChange={setSavings} />
          <Money label="Existing life insurance" value={existing} onChange={setExisting} />
        </div>
        <div className="result" aria-live="polite">
          <p>Total need: <strong>{usd(r.need)}</strong></p>
          <p className="big">Coverage gap: {usd(r.gap)}</p>
          <p className="notice">This uses the common "debts, income, mortgage, education" method. A licensed insurance professional can refine it. Who you name as beneficiary matters as much as the amount, especially with minor children.</p>
        </div>
      </div>
      <EmailCapture kind="report" interest="tool:life-insurance-needs" title="Email me the beneficiary checklist" body="How to name beneficiaries so insurance money reaches your children the way you intend, plus your numbers." details={{ need: r.need, gap: r.gap }} />
    </>
  );
}
