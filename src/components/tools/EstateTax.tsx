"use client";

import { useState } from "react";
import { FIGURES } from "@/config/figures";
import { EmailCapture } from "@/components/capture";
import { Money, YesNo, usd } from "./shared";

export function estimateFederalEstateTax(input: { assets: number; debts: number; insurance: number; married: boolean; portability: boolean }) {
  const gross = input.assets + input.insurance;
  const net = Math.max(0, gross - input.debts);
  const exemption = FIGURES.federalExemption * (input.married && input.portability ? 2 : 1);
  const taxable = Math.max(0, net - exemption);
  return { gross, net, exemption, taxable, tax: Math.round(taxable * FIGURES.federalTopRate), share: exemption ? net / exemption : 0 };
}

export default function EstateTax() {
  const [assets, setAssets] = useState(1_500_000);
  const [insurance, setInsurance] = useState(500_000);
  const [debts, setDebts] = useState(300_000);
  const [married, setMarried] = useState(true);
  const [portability, setPortability] = useState(true);
  const r = estimateFederalEstateTax({ assets, debts, insurance, married, portability });
  return (
    <>
      <div className="tool">
        <div className="row">
          <Money label="Everything you own" value={assets} onChange={setAssets} help="Home, savings, investments, retirement accounts, business" />
          <Money label="Life insurance death benefit" value={insurance} onChange={setInsurance} help="Owned by you, counts toward your estate" />
          <Money label="Debts" value={debts} onChange={setDebts} help="Mortgage, loans, cards" />
        </div>
        <YesNo label="I am married" value={married} onChange={setMarried} />
        {married && <YesNo label="Assume the surviving spouse files to keep the unused exemption (portability)" value={portability} onChange={setPortability} />}
        <div className="result" aria-live="polite">
          <div>Net estate: <strong>{usd(r.net)}</strong> · Federal exemption used here: <strong>{usd(r.exemption)}</strong></div>
          <div className="bar" style={{ margin: "10px 0" }} aria-hidden="true"><span style={{ width: `${Math.min(100, r.share * 100)}%` }} /></div>
          {r.taxable > 0 ? (
            <p className="big">About {usd(r.tax)} federal estate tax</p>
          ) : (
            <p className="big">No federal estate tax expected</p>
          )}
          <p className="notice">
            Your estate is at {Math.round(r.share * 100)}% of the federal exemption ({FIGURES.year} figure of {usd(FIGURES.federalExemption)} per person, verify each year).
            Some states have their own estate or inheritance tax with much lower thresholds. This is an estimate, not tax advice.
          </p>
        </div>
      </div>
      <EmailCapture
        kind="report"
        interest="tool:estate-tax-estimator"
        title="Email me these numbers and the state tax check"
        body="We'll send your estimate and note whether your state has its own estate or inheritance tax."
        details={{ net: r.net, taxable: r.taxable, married }}
      />
    </>
  );
}
