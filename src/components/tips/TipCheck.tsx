"use client";

import Link from "next/link";
import { useState } from "react";
import { track } from "@/components/capture";
import type { TipCheckOption } from "@/config/social-tips";

/** One-question quick check: tap the answer that fits and see what usually happens next. */
export default function TipCheck({ slug, question, options }: { slug: string; question: string; options: TipCheckOption[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const choice = picked === null ? null : options[picked];
  return (
    <section className="tip-check" aria-labelledby="tip-check-q">
      <p className="kicker">Quick check</p>
      <h2 id="tip-check-q">{question}</h2>
      <div className="tip-check__options" role="group" aria-label={question}>
        {options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            className={`tip-check__option${picked === i ? " is-picked" : ""}`}
            aria-pressed={picked === i}
            onClick={() => {
              setPicked(i);
              track("tip_check", { tip: slug, answer: i + 1 });
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="tip-check__result" aria-live="polite">
        {choice ? (
          <>
            <p>{choice.result}</p>
            <p>
              <Link href={choice.next.href}>{choice.next.label}</Link>
            </p>
            <p className="tip-check__note">This is what usually happens, not advice for your situation. An attorney can tell you what applies to you.</p>
          </>
        ) : (
          <p className="tip-check__hint">Tap the answer that fits. Nothing is saved or sent.</p>
        )}
      </div>
    </section>
  );
}
