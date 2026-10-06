"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import type { MiniPicker } from "@/config/visual-kit";

/** One question, an instant plain-language answer and a next step. Answers stay on the page. */
export function MiniPickerView({ picker, id }: { picker: Omit<MiniPicker, "match">; id: string }) {
  const [at, setAt] = useState<number | null>(null);
  const opt = at === null ? null : picker.options[at];
  return (
    <div className="vk-picker">
      <p className="vk-picker__q" id={`${id}-q`}>{picker.question}</p>
      <div className="vk-picker__opts" role="group" aria-labelledby={`${id}-q`}>
        {picker.options.map((o, i) => (
          <button key={o.label} type="button" className={`vk-opt${at === i ? " is-on" : ""}`} aria-pressed={at === i} onClick={() => setAt(i)}>
            {o.label}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {opt && (
          <div className={`vk-picker__result vk-tone--${opt.tone}`}>
            <p className="vk-picker__title">{opt.title}</p>
            <p>{opt.text}</p>
            <p className="vk-picker__next">
              <Link href={picker.next.href} className="arrow-link">
                {picker.next.label} <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <button type="button" className="vk-link" onClick={() => setAt(null)}>
                <RotateCcw size={14} aria-hidden="true" /> Start over
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
