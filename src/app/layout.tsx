import type { Metadata } from "next";
import Link from "next/link";
import SourceTracker from "@/components/SourceTracker";
import { firm } from "@/config/firm";
import { ExitIntent, StickyContactBar } from "@/components/capture";
import { JsonLd, legalServiceLd, SITE_URL } from "@/lib/seo";
import "./globals.css";
import "@/components/visuals/visuals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${firm.brandName} | Estate planning with a real attorney`, template: `%s | ${firm.brandName}` },
  description: "Wills, trusts and powers of attorney, explained plainly by an estate planning attorney.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <div className="container wide">
            <Link href="/" className="brand">{firm.brandName}</Link>
            <nav className="main" aria-label="Main">
              <Link href="/guides" className="nav-keep">Guides</Link>
              <Link href="/blog">Articles</Link>
              <Link href="/tools">Tools</Link>
              <Link href="/checklists">Checklists</Link>
              <Link href="/resources">All resources</Link>
              <Link href="/pricing">Pricing</Link>
              <a href={`tel:${firm.phone.replace(/\D/g, "")}`}>{firm.phone}</a>
              <Link href="/plan-finder" className="button">Book a consult</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <StickyContactBar phone={firm.phone} textNumber={firm.textNumber} />
        <ExitIntent />
        <JsonLd data={legalServiceLd()} />
        <footer className="site">
          <div className="container">
            <p>
              Attorney advertising. {firm.firmLegalName}, {firm.officeAddress}. Responsible attorney: {firm.attorneyName}.
              The information on this site is general education, not legal advice. No attorney-client relationship is
              formed until an engagement agreement is signed.
            </p>
            <p>
              <Link href="/wills">Wills</Link> · <Link href="/living-trusts">Living trusts</Link> · <Link href="/power-of-attorney">Power of attorney</Link> ·{" "}
              <Link href="/healthcare-directives">Healthcare directives</Link> · <Link href="/probate">Probate</Link> ·{" "}
              <Link href="/trust-administration">Trust administration</Link> · <Link href="/estate-planning-for-parents">Planning for parents</Link> ·{" "}
              <Link href="/how-it-works">How it works</Link> · <Link href="/about-the-attorney">About the attorney</Link> · <Link href="/pricing">Pricing</Link>
            </p>
            <p>
              <Link href="/resources">Resources</Link> · <Link href="/glossary">Glossary</Link> · <Link href="/faq">FAQ</Link> ·{" "}
              <Link href="/explainers">Explainers</Link> · <Link href="/course">Free course</Link> · <Link href="/about">About</Link> ·{" "}
              <Link href="/contact">Contact</Link> · <Link href="/intake">Full intake form</Link> · <Link href="/callback">Request a call back</Link>
            </p>
            <p>
              <Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/disclaimer">Disclaimer</Link> ·{" "}
              <Link href="/legal/sms-terms">Text message terms</Link> · <Link href="/legal/how-we-work">How we work</Link>
            </p>
          </div>
        </footer>
        <SourceTracker />
      </body>
    </html>
  );
}
