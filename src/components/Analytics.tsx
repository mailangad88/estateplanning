"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/components/capture";
import { assignedVariants } from "@/lib/experiments";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

function pageType(path: string): string {
  const first = path.split("/")[1] ?? "";
  const map: Record<string, string> = {
    "": "home", guides: "article", blog: "article", compare: "article", "life-events": "article", tools: "tool",
    quizzes: "tool", free: "resource", checklists: "resource", "plan-finder": "lead_form", pricing: "pricing",
    "estate-planning": "state_page", course: "course", learn: "article", explainers: "article", mistakes: "article",
    "estate-planning-for": "audience", wills: "service", "living-trusts": "service", "power-of-attorney": "service",
    "healthcare-directives": "service", probate: "service", "trust-administration": "service", book: "book", decide: "tool",
  };
  return map[first] ?? "other";
}

/**
 * Loads Google Tag Manager when NEXT_PUBLIC_GTM_ID is set (GA4 and ad tags are configured
 * inside GTM), and sends scroll-depth and CTA-click events that follow the playbook's event
 * taxonomy. Events never carry names, emails, phone numbers or answers.
 */
export default function Analytics() {
  const path = usePathname();

  useEffect(() => {
    const type = pageType(path);
    const marks = [25, 50, 75, 100];
    const sent = new Set<number>();
    const onScroll = () => {
      const doc = document.documentElement;
      const pct = ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100;
      for (const m of marks) {
        if (pct >= m - 1 && !sent.has(m)) {
          sent.add(m);
          track("scroll_depth", { percent: m, page_type: type });
        }
      }
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest("a, button");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      // Call and text taps are already tracked by the sticky bar (click_to_call, click_to_text).
      if (/^\/(book|plan-finder|free\/|quizzes\/|tools\/)/.test(href)) {
        const location = a.closest("header") ? "header" : a.closest(".sticky-bar") ? "sticky" : a.closest(".modal") ? "exit" : a.closest("footer") ? "footer" : "inline";
        const from = href.startsWith("/book") ? new URLSearchParams(href.split("?")[1] ?? "").get("from") : null;
        track("cta_click", { cta_id: href.split("?")[0], location, page_type: type, ...(from ? { from } : {}), ...assignedVariants() });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
    };
  }, [path]);

  // Consent Mode v2 defaults (all ad and analytics storage denied) are set in src/app/layout.tsx before this
  // loads, so GTM tags wait for the visitor's choice made in CookieConsent.
  if (!GTM_ID) return null;
  return (
    <Script id="gtm" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID.replace(/[^A-Z0-9-]/gi, "")}');`}
    </Script>
  );
}
