"use client";

import { useEffect, useId, useRef, useState } from "react";
import { track } from "@/components/capture";
import { assignedVariants } from "@/lib/experiments";

interface Props {
  link: string;
  name?: string;
  email?: string;
  leadRef?: string;
  /** Prefilled into the booking form's notes so the attorney sees context before the call. */
  notes?: string;
  /** Extra booking metadata (placement, topic id). Keys and values must not identify the visitor. */
  metadata?: Record<string, string>;
  onBooked?: () => void;
}

type CalFn = ((...args: unknown[]) => void) & { loaded?: boolean; ns?: Record<string, unknown>; q?: unknown[] };

/** Cal.com's official loader snippet: queues calls, then loads embed.js once. */
function loadCal(): CalFn {
  const w = window as unknown as { Cal?: CalFn };
  if (w.Cal) return w.Cal;
  const cal: CalFn = function (...args: unknown[]) {
    (cal.q = cal.q || []).push(args);
  };
  cal.ns = {};
  cal.q = [];
  w.Cal = cal;
  const s = document.createElement("script");
  s.src = "https://app.cal.com/embed/embed.js";
  s.async = true;
  document.head.appendChild(s);
  return cal;
}

/** Inline Cal.com booking calendar. Reports a successful booking through track("consult_booked"). */
export default function CalcomEmbed({ link, name, email, leadRef, notes, metadata, onBooked }: Props) {
  const id = "cal-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [booked, setBooked] = useState(false);
  const onBookedRef = useRef(onBooked);
  onBookedRef.current = onBooked;

  useEffect(() => {
    const Cal = loadCal();
    const config: Record<string, string> = { layout: "month_view" };
    if (name) config.name = name;
    if (email) config.email = email;
    if (leadRef) config["metadata[leadRef]"] = leadRef;
    if (notes) config.notes = notes;
    for (const [k, v] of Object.entries(metadata ?? {})) if (v) config[`metadata[${k}]`] = v;
    Cal("init", { origin: "https://app.cal.com" });
    document.getElementById(id)?.replaceChildren(); // re-init (new notes) replaces the old calendar instead of stacking a second one
    Cal("inline", { elementOrSelector: "#" + id, calLink: link, config });
    Cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    let fired = false;
    const handleBooked = () => {
      if (fired) return;
      fired = true;
      const variants: Record<string, string> = {};
      for (const [k, v] of Object.entries(assignedVariants())) variants[`exp_${k}`] = v;
      track("consult_booked", { source: "calcom", ...(metadata?.from ? { from: metadata.from } : {}), ...variants });
      setBooked(true);
      onBookedRef.current?.();
    };
    Cal("on", { action: "bookingSuccessful", callback: handleBooked });
    Cal("on", { action: "bookingSuccessfulV2", callback: handleBooked });
    // metadata is compared by value so a new object each render does not re-init the embed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, link, name, email, leadRef, notes, JSON.stringify(metadata ?? {})]);

  return (
    <>
      <div id={id} style={{ width: "100%", minHeight: 680, overflow: "auto" }} />
      {booked && (
        <p className="notice" role="status">
          You are booked. A confirmation is on its way to your email.
        </p>
      )}
    </>
  );
}
