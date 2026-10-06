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
import Script from "next/script";
import Analytics from "@/components/Analytics";
import CookieConsent, { CookieSettingsButton } from "@/components/CookieConsent";
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

// Google Consent Mode v2 defaults. Runs before GTM loads (see Analytics.tsx); applies a saved choice from
// localStorage and honours Global Privacy Control for the ad_* signals.
const CONSENT_DEFAULT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});
try{var c=JSON.parse(localStorage.getItem('efp-consent')||'null');if(c&&c.v===1&&typeof c.analytics==='boolean'&&typeof c.ads==='boolean'){var g=navigator.globalPrivacyControl===true;var a=c.ads&&!g?'granted':'denied';gtag('consent','update',{ad_storage:a,ad_user_data:a,ad_personalization:a,analytics_storage:c.analytics?'granted':'denied'});}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script id="consent-default" strategy="beforeInteractive">{CONSENT_DEFAULT}</Script>
      </head>
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
        <CookieConsent />
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
            <p className="notice"><CookieSettingsButton /></p>
          </div>
        </footer>
        <SourceTracker />
      </body>
    </html>
  );
}
