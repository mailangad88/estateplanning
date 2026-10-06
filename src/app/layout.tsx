import type { Metadata } from "next";
import Link from "next/link";
import { firm } from "@/config/firm";
import "./globals.css";
import "@/components/visuals/visuals.css";

export const metadata: Metadata = {
  title: `${firm.brandName} | Estate planning with a real attorney`,
  description: "Wills, trusts and powers of attorney, explained plainly by an estate planning attorney.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <div className="container">
            <Link href="/" className="brand">{firm.brandName}</Link>
            <a href={`tel:${firm.phone.replace(/\D/g, "")}`}>Call {firm.phone}</a>
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
              <Link href="/legal/sms-terms">Text message terms</Link> · <Link href="/legal/how-we-work">How we work</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
