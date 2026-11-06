"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { track } from "@/components/capture";
import { useTrackingNumber } from "@/components/TrackedPhone";
import { firm } from "@/config/firm";
import { bookHref, fromForPath, topicForPath } from "@/lib/book";
import { useVariant } from "@/lib/experiments";
import { offerForPath } from "@/config/booking-offers";

/** Label for the booking button under the `book_cta_copy` test. */
export function useBookLabel(): string {
  return useVariant("book_cta_copy") === "see_times" ? "See open times" : "Book a consult";
}

/** Fires `cta_view` once when the element is half on screen, so click-through can be read per placement. */
function useViewEvent(ref: React.RefObject<HTMLElement | null>, from: string, offer: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track("cta_view", { cta_id: "/book", from, offer });
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, from, offer]);
}

/**
 * The booking call to action used across content pages. Booking leads by default (the `cta_primary`
 * test can put the plan finder first instead), the topic is guessed from the page path, and the link
 * carries `from` so every booking traces back to its placement.
 *
 * `inline` is a one-line prompt for the top of an article; `card` is the full end-of-page box.
 */
export default function BookCta({
  from,
  topic,
  title,
  body,
  layout = "card",
  showPlanFinder = true,
}: {
  from?: string;
  topic?: string;
  title?: string;
  body?: string;
  layout?: "card" | "inline";
  showPlanFinder?: boolean;
}) {
  const path = usePathname() ?? "/";
  const place = from ?? `${fromForPath(path)}-${layout === "inline" ? "inline" : "cta"}`;
  // Audience offer from the pain-point research; approval-gated wording falls back to neutral copy.
  const offer = offerForPath(path);
  const href = bookHref(place, topic ?? topicForPath(path) ?? offer.topic);
  const label = useBookLabel();
  const order = useVariant("cta_primary");
  const phone = useTrackingNumber(firm.phone);
  const ref = useRef<HTMLElement>(null);
  useViewEvent(ref, place, offer.id);
  const tel = `tel:${phone.replace(/\D/g, "")}`;

  if (layout === "inline") {
    return (
      <aside ref={ref} className="book-inline no-print" aria-label="Talk to an attorney">
        <span>{title ?? (offer.callFirst ? offer.title : "Want to talk this through for your family?")}</span>{" "}
        {offer.callFirst ? (
          <>
            <a href={tel} className="book-inline__link">Call {phone}</a>
            <span className="book-inline__alt"> or <Link href={href}>pick a time</Link></span>
          </>
        ) : (
          <>
            <Link href={href} className="book-inline__link">{label}</Link>
            <span className="book-inline__alt"> or call <a href={tel}>{phone}</a></span>
          </>
        )}
      </aside>
    );
  }

  const book = <Link key="book" className={order === "book_first" ? "button" : "button secondary"} href={href}>{label}</Link>;
  const finder = showPlanFinder ? (
    <Link key="finder" className={order === "book_first" ? "button secondary" : "button"} href="/plan-finder">
      {order === "book_first" ? "Not sure yet? 2-minute plan finder" : "Start the plan finder"}
    </Link>
  ) : null;
  const call = <a key="call" className={offer.callFirst ? "button" : "button secondary"} href={tel}>Call {phone}</a>;
  // Crisis pages: phone first, calendar second, no plan finder (research: these visitors need help now).
  const actions = offer.callFirst
    ? [call, <Link key="book" className="button secondary" href={href}>{label}</Link>]
    : [...(order === "book_first" ? [book, finder] : [finder, book]), call];
  return (
    <aside ref={ref} className="cta book-cta" aria-label="Talk to an attorney" data-offer={offer.id}>
      <strong>{title ?? offer.title}</strong>
      <p>{body ?? offer.body}</p>
      <p className="cta-actions">{actions}</p>
    </aside>
  );
}
