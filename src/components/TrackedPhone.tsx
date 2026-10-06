"use client";

import { useEffect, useState } from "react";
import { firm } from "@/config/firm";
import { firstTouchFromParams, pickTrackingNumber, telHref, type FirstTouch } from "@/lib/tracking-number";

const KEY = "fpl.dni.v1";

/** First-touch source for this visit. Set once per browser session; later campaign clicks do not replace it. */
function firstTouch(): FirstTouch | null {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved) return JSON.parse(saved) as FirstTouch;
  } catch {
    // storage blocked: fall through and use this page's parameters only
  }
  const touch = firstTouchFromParams(new URLSearchParams(window.location.search)) ?? {};
  try {
    sessionStorage.setItem(KEY, JSON.stringify(touch));
  } catch {
    // ignore
  }
  return touch;
}

/** The phone number to show this visitor. Renders `fallback` on the server and before hydration. */
export function useTrackingNumber(fallback: string = firm.phone): string {
  const [phone, setPhone] = useState(fallback);
  useEffect(() => {
    try {
      setPhone(pickTrackingNumber(firstTouch(), firm.trackingNumbers, fallback));
    } catch {
      setPhone(fallback);
    }
  }, [fallback]);
  return phone;
}

/** Header phone link with dynamic number insertion. */
export function TrackedPhoneLink({ fallback = firm.phone, className }: { fallback?: string; className?: string }) {
  const phone = useTrackingNumber(fallback);
  return (
    <a href={telHref(phone)} className={className}>
      {phone}
    </a>
  );
}
