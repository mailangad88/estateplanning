"use client";

import { useEffect, useId, useState } from "react";
import { track } from "@/components/capture";
import { assignedVariants } from "@/lib/experiments";

interface Props {
  link: string;
  name?: string;
  email?: string;
  leadRef?: string;
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
export default function CalcomEmbed({ link, name, email, leadRef }: Props) {
  const id = "cal-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    const Cal = loadCal();
    const config: Record<string, string> = { layout: "month_view" };
    if (name) config.name = name;
    if (email) config.email = email;
    if (leadRef) config["metadata[leadRef]"] = leadRef;
    Cal("init", { origin: "https://app.cal.com" });
    Cal("inline", { elementOrSelector: "#" + id, calLink: link, config });
    Cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    let fired = false;
    const onBooked = () => {
      if (fired) return;
      fired = true;
      const variants: Record<string, string> = {};
      for (const [k, v] of Object.entries(assignedVariants())) variants[`exp_${k}`] = v;
      track("consult_booked", { source: "calcom", ...variants });
      setBooked(true);
    };
    Cal("on", { action: "bookingSuccessful", callback: onBooked });
    Cal("on", { action: "bookingSuccessfulV2", callback: onBooked });
  }, [id, link, name, email, leadRef]);

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
