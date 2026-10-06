import type { Metadata } from "next";
import Link from "next/link";
import SourceTracker from "@/components/SourceTracker";
import { firm } from "@/config/firm";
import { ExitIntent, StickyContactBar } from "@/components/capture";
import { Disclosures } from "@/components/Disclosures";
import MegaFooter from "@/components/MegaFooter";
import { TrackedPhoneLink } from "@/components/TrackedPhone";
import { JsonLd, siteGraphLd, SITE_URL } from "@/lib/seo";
import "./globals.css";
import "@/components/visuals/visuals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${firm.brandName} | Estate planning with a real attorney`, template: `%s | ${firm.brandName}` },
  description: "Wills, trusts and powers of attorney, explained plainly by an estate planning attorney.",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
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
              <Link href="/learn">Library</Link>
              <Link href="/blog">Articles</Link>
              <Link href="/tools">Tools</Link>
              <Link href="/free">Free downloads</Link>
              <Link href="/checklists">Checklists</Link>
              <Link href="/resources">All resources</Link>
              <Link href="/pricing">Pricing</Link>
              <TrackedPhoneLink fallback={firm.phone} />
              <Link href="/plan-finder" className="button">Book a consult</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <StickyContactBar phone={firm.phone} textNumber={firm.textNumber} />
        <ExitIntent />
        <JsonLd data={siteGraphLd()} />
        <footer className="site">
          <div className="container">
            <MegaFooter />
            <Disclosures />
          </div>
        </footer>
        <SourceTracker />
      </body>
    </html>
  );
}
