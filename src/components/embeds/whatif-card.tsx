"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CircleAlert, RotateCcw, ShieldCheck } from "lucide-react";

export interface WhatIfData {
  id: string;
  title: string;
  delay: string;
  without: string;
  withPlan: string;
  doc: { label: string; href: string };
  learn?: string;
}

/**
 * One "what if" from the shared scenario list: the reader picks "plan for it" or "put it off" and
 * sees what usually happens. Nothing they pick is stored or sent anywhere.
 */
export function WhatIfCard({ s, compact }: { s: WhatIfData; compact?: boolean }) {
  const [choice, setChoice] = useState<"plan" | "wait" | null>(null);
  return (
    <div className={`vk-whatif${compact ? " vk-whatif--compact" : ""}${choice ? ` is-${choice}` : ""}`}>
      <p className="vk-whatif__q">
        <span className="vk-whatif__mark" aria-hidden="true">?</span>
        <strong>{s.title}</strong>
      </p>
      {!compact && <p className="vk-whatif__delay">&ldquo;{s.delay}&rdquo;</p>}
      {!choice ? (
        <div className="vk-whatif__choices" role="group" aria-label={`Your choice: ${s.title}`}>
          <button type="button" className="vk-btn vk-btn--plan" onClick={() => setChoice("plan")}>
            <ShieldCheck size={18} aria-hidden="true" /> Plan for it
          </button>
          <button type="button" className="vk-btn vk-btn--wait" onClick={() => setChoice("wait")}>
            <CircleAlert size={18} aria-hidden="true" /> Put it off
          </button>
        </div>
      ) : (
        <div className={`vk-whatif__result vk-whatif__result--${choice}`} aria-live="polite">
          <p className="vk-whatif__h">
            {choice === "plan" ? <ShieldCheck size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
            {choice === "plan" ? "With a plan" : "If it waits"}
          </p>
          <p>{choice === "plan" ? s.withPlan : s.without}</p>
          <p className="vk-whatif__links">
            <Link href={s.doc.href}>{s.doc.label}</Link>
            {s.learn && (
              <Link href={s.learn} className="arrow-link">
                Read more <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
            <button type="button" className="vk-link" onClick={() => setChoice(choice === "plan" ? "wait" : "plan")}>
              <RotateCcw size={14} aria-hidden="true" /> {choice === "plan" ? "See what happens if it waits" : "See it with a plan"}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
