"use client";

import { useEffect, useState } from "react";
import { track } from "@/components/capture";
import { site } from "@/config/site";

/**
 * "Send this to family" bar. Estate planning is a family conversation, so the most natural share is to a
 * spouse, sibling or parent: native share sheet on phones, text, email and copy-link first, social second.
 * Shared links carry utm_source=share so leads from shares show up as their own channel. Nothing is sent
 * anywhere until the visitor picks an option; the analytics event records only the method.
 */
export default function ShareBar({ path, title, prompt = "Send this to someone you plan with" }: { path: string; title: string; prompt?: string }) {
  const [copied, setCopied] = useState(false);
  // Decided after hydration so the server and first client render match.
  const [canNative, setCanNative] = useState(false);
  useEffect(() => setCanNative(typeof navigator.share === "function"), []);
  const base = site.url.replace(/\/$/, "");
  const link = (medium: string) => `${base}${path}?utm_source=share&utm_medium=${medium}`;
  const text = `${title}, a plain-English explainer I found useful:`;
  const enc = encodeURIComponent;

  const onNative = async () => {
    track("share", { method: "native" });
    try {
      await navigator.share({ title, text, url: link("native") });
    } catch {
      // closed the sheet: nothing to do
    }
  };
  const onCopy = async () => {
    track("share", { method: "copy" });
    try {
      await navigator.clipboard.writeText(link("copy"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link", link("copy"));
    }
  };
  const links: { label: string; href: string; method: string }[] = [
    { label: "Text", method: "sms", href: `sms:?&body=${enc(`${text} ${link("sms")}`)}` },
    { label: "Email", method: "email", href: `mailto:?subject=${enc(title)}&body=${enc(`${text}\n\n${link("email")}`)}` },
    { label: "WhatsApp", method: "whatsapp", href: `https://wa.me/?text=${enc(`${text} ${link("whatsapp")}`)}` },
    { label: "Facebook", method: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link("facebook"))}` },
    { label: "LinkedIn", method: "linkedin", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(link("linkedin"))}` },
    { label: "X", method: "x", href: `https://x.com/intent/post?text=${enc(title)}&url=${enc(link("x"))}` },
  ];
  return (
    <aside className="share-bar no-print" aria-label="Share this page">
      <p className="share-bar__prompt">{prompt}</p>
      <div className="share-bar__actions">
        {canNative && (
          <button type="button" className="button small" onClick={onNative}>
            Share
          </button>
        )}
        <button type="button" className="button small secondary" onClick={onCopy} aria-live="polite">
          {copied ? "Link copied" : "Copy link"}
        </button>
        {links.map((l) => (
          <a
            key={l.method}
            className="share-bar__link"
            href={l.href}
            target={l.href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer nofollow"
            onClick={() => track("share", { method: l.method })}
          >
            {l.label}
          </a>
        ))}
      </div>
    </aside>
  );
}
