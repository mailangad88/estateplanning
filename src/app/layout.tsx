import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { firm } from "@/config/firm";
import { site } from "@/config/site";
import { attorneySchema, graph, organizationSchema, websiteSchema } from "@/lib/schema";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${firm.brandName} | Estate planning with a real attorney`,
    template: `%s | ${firm.brandName}`,
  },
  description: "Wills, trusts and powers of attorney, explained plainly by an estate planning attorney.",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
  openGraph: { siteName: firm.brandName, type: "website", locale: "en_US" },
  robots: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={graph(organizationSchema(), websiteSchema(), attorneySchema())} />
        <header className="site">
          <div className="container">
            <Link href="/" className="brand">{firm.brandName}</Link>
            <nav className="site-nav" aria-label="Main">
              <Link href="/learn">Guides</Link>
              <Link href="/estate-planning">Laws by state</Link>
              <Link href="/glossary">Glossary</Link>
              <a href={`tel:${firm.phone.replace(/\D/g, "")}`}>Call {firm.phone}</a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site">
          <div className="container">
            <p>
              Attorney advertising. {firm.firmLegalName}, {firm.officeAddress}. Responsible attorney: {firm.attorneyName}.
              The information on this site is general education, not legal advice. No attorney-client relationship is
              formed until an engagement agreement is signed.
            </p>
            <p>
              <Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/disclaimer">Disclaimer</Link> ·{" "}
              <Link href="/legal/sms-terms">Text message terms</Link> · <Link href="/legal/how-we-work">How we work</Link> ·{" "}
              <Link href="/learn">Guides</Link> · <Link href="/glossary">Glossary</Link> ·{" "}
              <Link href="/estate-planning">Laws by state</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
