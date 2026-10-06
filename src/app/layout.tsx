import type { Metadata } from "next";
import Link from "next/link";
import SourceTracker from "@/components/SourceTracker";
import { firm } from "@/config/firm";
import { ExitIntent, StickyContactBar } from "@/components/capture";
import { Disclosures } from "@/components/Disclosures";
import MegaFooter from "@/components/MegaFooter";
import SiteHeader, { BrandMark } from "@/components/SiteHeader";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import { TrackedPhoneLink } from "@/components/TrackedPhone";
import Analytics from "@/components/Analytics";
import { JsonLd, siteGraphLd, SITE_URL } from "@/lib/seo";
import { IS_STAGING } from "@/lib/env";
import "./globals.css";
import "@/components/visuals/visuals.css";
import "./design.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${firm.brandName} | Estate planning with a real attorney`, template: `%s | ${firm.brandName}` },
  description: "Wills, trusts and powers of attorney, explained plainly by an estate planning attorney.",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
  ...(IS_STAGING ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {IS_STAGING && (
          <div className="staging-banner" role="note">Staging preview. Draft content pending attorney review, not a live law firm site. Test submissions only: forms are not sent to the firm.</div>
        )}
        <a href="#main" className="skip-link">Skip to content</a>
        <SiteHeader brandName={firm.brandName} phone={firm.phone} />
        <main id="main" className="container">{children}</main>
        <StickyContactBar phone={firm.phone} textNumber={firm.textNumber} />
        <ExitIntent />
        <Analytics />
        <JsonLd data={siteGraphLd()} />
        <footer className="site">
          <div className="footer-cta">
            <div className="container wide footer-cta__inner">
              <div>
                <p className="kicker">Ready when you are</p>
                <h2>Talk it through with an attorney, at a flat fee.</h2>
                <p>Answer a few questions, or just call. Nothing is signed until you have seen the fee.</p>
              </div>
              <p className="cta-row">
                <Link className="button" href="/plan-finder">Start the plan finder</Link>
                <TrackedPhoneLink fallback={firm.phone} className="button ghost-light" />
              </p>
            </div>
          </div>
          <div className="container wide footer-main">
            <div className="footer-brand">
              <Link href="/" className="brand">
                <BrandMark />
                <span>{firm.brandName}</span>
              </Link>
              <p>Wills, living trusts, powers of attorney and healthcare directives, explained plainly and prepared by an estate planning attorney.</p>
            </div>
            <MegaFooter />
          </div>
          <div className="container wide footer-legal">
            <Disclosures />
          </div>
        </footer>
        <SourceTracker />
      </body>
    </html>
  );
}
