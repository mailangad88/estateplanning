import Link from "next/link";
import { MONEY_PAGES } from "@/content/money-pages";
import { TOOLS } from "@/config/tools";
import { getAudiences } from "@/lib/content";
import { getHubs } from "@/lib/hubs";

const SERVICE_KEYS = ["wills", "living-trusts", "power-of-attorney", "healthcare-directives", "probate", "trust-administration", "estate-planning-for-parents"];

/** Grouped site map shown above the legal notices. Counts and lists come from the same data the hubs use. */
export default function MegaFooter() {
  const services = SERVICE_KEYS.map((k) => MONEY_PAGES[k]).filter(Boolean);
  const audiences = getAudiences();
  const hubs = getHubs().filter((h) => h.href !== "/free" && h.href !== "/tools" && h.href !== "/estate-planning-for");
  return (
    <nav className="mega-footer" aria-label="Site map">
      <div>
        <h2>Services</h2>
        <ul>
          {services.map((m) => (
            <li key={m.path}><Link href={m.path}>{m.crumb}</Link></li>
          ))}
          <li><Link href="/pricing">Pricing</Link></li>
          <li><Link href="/how-it-works">How it works</Link></li>
        </ul>
      </div>
      <div>
        <h2>By situation</h2>
        <ul>
          {audiences.map((a) => (
            <li key={a.slug}><Link href={`/estate-planning-for/${a.slug}`}>{a.title}</Link></li>
          ))}
          <li><Link href="/estate-planning-for">All situations</Link></li>
        </ul>
      </div>
      <div>
        <h2>Learn</h2>
        <ul>
          {hubs.map((h) => (
            <li key={h.href}><Link href={h.href}>{h.label}</Link> <span className="count">({h.count})</span></li>
          ))}
          <li><Link href="/resources">Everything in one place</Link></li>
        </ul>
      </div>
      <div>
        <h2>Free tools</h2>
        <ul>
          {TOOLS.map((t) => (
            <li key={t.slug}><Link href={`/tools/${t.slug}`}>{t.title}</Link></li>
          ))}
          <li><Link href="/tools">All tools</Link></li>
        </ul>
      </div>
      <div>
        <h2>Free resources</h2>
        <ul>
          <li><Link href="/free">Free downloads and email courses</Link></li>
          <li><Link href="/checklists">Checklists</Link></li>
          <li><Link href="/course">7-day course</Link></li>
        </ul>
      </div>
      <div>
        <h2>Company</h2>
        <ul>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/about-the-attorney">About the attorney</Link></li>
          <li><Link href="/editorial-policy">How we review</Link></li>
          <li><Link href="/contact">Contact</Link></li>
          <li><Link href="/intake">Full intake form</Link></li>
          <li><Link href="/callback">Request a call back</Link></li>
          <li><Link href="/legal/privacy">Privacy</Link></li>
          <li><Link href="/legal/disclaimer">Disclaimer</Link></li>
          <li><Link href="/legal/sms-terms">Text message terms</Link></li>
          <li><Link href="/legal/how-we-work">How we work</Link></li>
        </ul>
      </div>
    </nav>
  );
}
