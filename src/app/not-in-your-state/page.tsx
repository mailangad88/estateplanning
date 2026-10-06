import type { Metadata } from "next";
import Link from "next/link";
import { servedStates } from "@/config/firm";
import { PageHeader } from "@/components/ui";
import { EmailCapture } from "@/components/capture";

export const metadata: Metadata = {
  title: "Outside our service area",
  description: "Where to find a licensed estate planning attorney if we do not practice in your state.",
  robots: { index: false, follow: true },
};

export default function NotInYourState() {
  return (
    <>
      <PageHeader kicker="Where we practice" art="HeroFamilyHome" title="We are not able to help in your state yet" lead={`Estate planning documents follow the law of the state you live in, so you want an attorney licensed there. Today we practice in: ${servedStates().join(", ")}.`} />
      <h2>Where to look instead</h2>
      <ul>
        <li>Your state bar&apos;s lawyer referral service. Search for &quot;[your state] bar lawyer referral service&quot;.</li>
        <li>The American College of Trust and Estate Counsel (ACTEC) fellow directory.</li>
        <li>Your local bar association&apos;s estate planning or elder law section.</li>
      </ul>
      <p>Our <Link href="/guides">guides</Link>, <Link href="/tools">tools</Link> and <Link href="/checklists">checklists</Link> are free to use wherever you live, and they will help you get ready for a meeting with any attorney.</p>
      <EmailCapture kind="newsletter" interest="out-of-state" title="Tell me when you start serving my state" cta="Notify me" />
    </>
  );
}
