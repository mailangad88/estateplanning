"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loadVisitor } from "@/lib/visitor";

const SEEN_KEY = "fpl.exitOffer.seenAt";
const QUIET_DAYS = 14;
/** Pages where an offer would interrupt someone already filling in a form. */
const SUPPRESSED = ["/plan-finder", "/intake", "/callback", "/resources/", "/guides/", "/legal/"];
const OFFER_SLUG = "estate-planning-checklist";

function recentlySeen(): boolean {
  try {
    const at = Number(window.localStorage.getItem(SEEN_KEY) ?? 0);
    return Date.now() - at < QUIET_DAYS * 86_400_000;
  } catch {
    return true; // storage blocked: never risk showing it on every page
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * One gentle offer of the free checklist, at most once every two weeks, and never to
 * someone who already gave us their details. Desktop: when the pointer leaves toward the
 * browser bar. Phones: a small bottom banner after reading half the page, never a
 * full-screen overlay (Google treats those as intrusive). No countdowns or fake scarcity.
 */
export default function ExitOffer() {
  const pathname = usePathname();
  const [mode, setMode] = useState<"hidden" | "modal" | "banner">("hidden");

  useEffect(() => {
    if (SUPPRESSED.some((p) => pathname.startsWith(p))) return;
    if (loadVisitor()?.contact.email || recentlySeen()) return;

    const armedAt = Date.now();
    const show = (m: "modal" | "banner") => {
      markSeen();
      setMode(m);
      cleanup();
    };
    const onMouseOut = (e: MouseEvent) => {
      // Only after a few seconds on the page, and only when leaving through the top edge.
      if (!e.relatedTarget && e.clientY <= 0 && Date.now() - armedAt > 5_000) show("modal");
    };
    const onScroll = () => {
      const depth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (depth > 0.5 && Date.now() - armedAt > 15_000) show("banner");
    };
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (finePointer) document.addEventListener("mouseout", onMouseOut);
    else window.addEventListener("scroll", onScroll, { passive: true });
    function cleanup() {
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", onScroll);
    }
    return cleanup;
  }, [pathname]);

  useEffect(() => {
    if (mode !== "modal") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMode("hidden");
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode]);

  if (mode === "hidden") return null;
  const href = `/resources/${OFFER_SLUG}?via=exit`;

  if (mode === "banner") {
    return (
      <aside className="exit-banner" role="complementary" aria-label="Free checklist">
        <span>Free: the complete estate planning checklist.</span>
        <Link href={href} className="button small" onClick={() => setMode("hidden")}>Get it</Link>
        <button type="button" className="linklike" aria-label="Dismiss" onClick={() => setMode("hidden")}>✕</button>
      </aside>
    );
  }

  return (
    <div className="modal-backdrop" onClick={() => setMode("hidden")}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="exit-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal__close linklike" aria-label="Close" onClick={() => setMode("hidden")}>✕</button>
        <h2 id="exit-title">Before you go: a free estate planning checklist</h2>
        <p>
          A plain-English list of the documents, people and accounts families usually review when they make a plan.
          Print it, or bring it to any attorney.
        </p>
        <p>
          <Link href={href} className="button" onClick={() => setMode("hidden")}>Send me the checklist</Link>{" "}
          <button type="button" className="button secondary" onClick={() => setMode("hidden")}>No thanks</button>
        </p>
      </div>
    </div>
  );
}
