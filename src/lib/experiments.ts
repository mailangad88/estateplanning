"use client";

import { useEffect, useState } from "react";
import { track } from "@/components/capture";

/**
 * Lightweight A/B tests. Each visitor gets a random anonymous id (no personal data), and
 * each experiment hashes that id to a stable variant. Exposures go to the dataLayer as
 * `experiment_view` and the variant rides along on conversion events and opt-ins, so a
 * GA4 or CRM report can compare variants. Add `?exp_<name>=<variant>` to a URL to preview one.
 *
 * Read results with the playbook's rule of thumb: about 1,000 visitors or 100 conversions
 * per variant before deciding, and check lead quality (consults booked), not only opt-ins.
 */
export const EXPERIMENTS = {
  /** Opt-in button copy on resource pages: generic vs value-specific (playbook test 6). */
  magnet_cta: ["instant_access", "specific"],
  /** Opt-in fields: first name + email vs email only (playbook test 2). */
  magnet_fields: ["name_email", "email_only"],
  /** Quiz results: show the score first vs ask for email first with a skip link (playbook test 3). */
  quiz_gate: ["result_first", "email_first"],
} as const;

export type ExperimentName = keyof typeof EXPERIMENTS;
export type Variant<N extends ExperimentName> = (typeof EXPERIMENTS)[N][number];

const ANON_KEY = "efp-anon";
const SEEN_KEY = "efp-exp-seen";

function anonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/**
 * FNV-1a with a murmur3 finalizer. Plain FNV's low bits barely change between similar
 * inputs, which would correlate one experiment's split with another's; the finalizer mixes them.
 */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function assign<N extends ExperimentName>(name: N, id: string): Variant<N> {
  const variants = EXPERIMENTS[name];
  return variants[hash(`${name}:${id}`) % variants.length] as Variant<N>;
}

function override<N extends ExperimentName>(name: N): Variant<N> | null {
  try {
    const v = new URLSearchParams(window.location.search).get(`exp_${name}`);
    return v && (EXPERIMENTS[name] as readonly string[]).includes(v) ? (v as Variant<N>) : null;
  } catch {
    return null;
  }
}

/** Variants this visitor has been assigned so far, for attaching to conversions. */
export function assignedVariants(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Returns the visitor's variant. Renders the first (control) variant on the server and the
 * first client paint, then switches, so pages stay static and never mismatch on hydration.
 */
export function useVariant<N extends ExperimentName>(name: N): Variant<N> {
  const [variant, setVariant] = useState<Variant<N>>(EXPERIMENTS[name][0] as Variant<N>);
  useEffect(() => {
    const v = override(name) ?? assign(name, anonId());
    setVariant(v);
    const seen = assignedVariants();
    if (seen[name] !== v) {
      try {
        sessionStorage.setItem(SEEN_KEY, JSON.stringify({ ...seen, [name]: v }));
      } catch {
        // ignore
      }
      track("experiment_view", { experiment: name, variant: v });
    }
  }, [name]);
  return variant;
}
