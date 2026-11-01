"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/components/capture";
import { bookHref } from "@/lib/book";
import { tipBookingSource } from "@/lib/social-links";

/** "Book a consult" link whose `from` slug records which platform sent the visitor (ig, fb, yt). */
export default function TipBookButton({ slug, topic, label = "Book a consult", className = "button" }: { slug: string; topic: string; label?: string; className?: string }) {
  const [from, setFrom] = useState(tipBookingSource(slug, null));
  useEffect(() => {
    try {
      setFrom(tipBookingSource(slug, new URLSearchParams(window.location.search).get("utm_source")));
    } catch {
      // keep the default
    }
  }, [slug]);
  return (
    <Link className={className} href={bookHref(from, topic)} onClick={() => track("tip_book_click", { tip: slug, from })}>
      {label}
    </Link>
  );
}
