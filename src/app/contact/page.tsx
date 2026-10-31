import type { Metadata } from "next";
import Link from "next/link";
import { firm } from "@/config/firm";
import { CallbackForm } from "@/components/capture";
import { Rich, RichFaqList } from "@/components/money-page";
import { Breadcrumbs, ReviewNote } from "@/components/ui";
import { PageHero } from "@/components/page-hero";
import { abs, breadcrumbLd, JsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Call, text, request a call back or book a consultation with an estate planning attorney in Illinois or New Jersey. Office address, hours, and what to expect when you reach out about a will, trust or probate.",
  alternates: { canonical: "/contact" },
};

const FAQS = [
  { q: "Will someone call me back if I leave a message?", a: `That is our aim. Stated response time: ${firm.responseTime}.` },
  { q: "Do you take cases outside Illinois and New Jersey?", a: "No. Attorneys in our network advise on Illinois and New Jersey law only. If you live elsewhere, your state bar's lawyer referral service can help. See [how it works](/how-it-works)." },
  { q: "I only want to know if a trust makes sense. Do I have to book?", a: "No. Try the [will or trust comparison](/tools/will-or-trust), read [living trusts](/living-trusts), or call with a quick question." },
  { q: "Can I text you?", a: "Only after you have opted in to text messages in our form. Please do not text sensitive information. See [text message terms](/legal/sms-terms)." },
  { q: "Is this a law firm or a referral service?", a: "This is a referral website, not a law firm. We match you with an appropriate estate planning attorney in our Illinois or New Jersey network, based on where you live and what you need. That attorney gives the legal advice, and you decide whether to hire them." },
  { q: "What should I tell you in the first message?", a: "Your name, how to reach you, the county you live in, and one sentence on what is happening. Skip details until we speak." },
];

export default function Contact() {
  const digits = firm.phone.replace(/\D/g, "");
  return (
    <>
      <PageHero
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Contact" }]} />}
        kicker="Contact"
        path="/contact"
        art="SpotVideoCall"
        title="Talk to us"
      >
        <ReviewNote reviewed={false} updated="October 2026" />
        <p className="cta-row no-print">
          <a className="button" href={`tel:${digits}`}>Call {firm.phone}</a>
          <Link className="button secondary" href="/book?from=contact">Book a consult</Link>
        </p>
      </PageHero>
      <div className="answer">
        <strong>In short</strong>
        The fastest way to reach us is by phone at {firm.phone}. You can also book a consultation online or request a call back, and a
        real person on our intake team will reply. Stated response time: {firm.responseTime}. If someone has just died or a family
        member is in the hospital, call, and tell us that first.
      </div>

      <h2>Choose how to reach us</h2>
      <ul className="cards">
        <li><a className="card-link" href={`tel:${digits}`}><span className="tag">Call</span><strong>{firm.phone}</strong><span className="card-desc">Talk now, or leave a message. Hours: {firm.officeHours}</span></a></li>
        {firm.textNumber && (
          <li><a className="card-link" href={`sms:${firm.textNumber.replace(/\D/g, "")}`}><span className="tag">Text</span><strong>{firm.textNumber}</strong><span className="card-desc">Text a question. Please leave out private details.</span></a></li>
        )}
        <li><Link className="card-link" href="/book?from=contact"><span className="tag">Online</span><strong>Book a consult</strong><span className="card-desc">Pick a time on the calendar. No questionnaire first.</span></Link></li>
        <li><Link className="card-link" href="/plan-finder"><span className="tag">Not sure</span><strong>Start the plan finder</strong><span className="card-desc">See what people in your situation commonly plan for.</span></Link></li>
      </ul>

      <h2>Request a call back</h2>
      <CallbackForm />
      <p className="notice">
        Please do not include Social Security numbers, account numbers or medical details. Contacting us does not create an
        attorney-client relationship, and what you send may not be protected until an attorney agrees to represent you.
      </p>

      <h2>Office and hours</h2>
      <p><Rich text={`${firm.brandName}, ${firm.officeAddress}. Hours: ${firm.officeHours}.`} /></p>

      <h2>Who answers</h2>
      <p>The person who answers is not acting as your lawyer and cannot give legal advice, but can explain how we match you with an attorney and what plans commonly cost. See <Link href="/pricing">pricing</Link> and <Link href="/how-it-works">how it works</Link>.</p>

      <RichFaqList faqs={FAQS} />
      <JsonLd data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]), { "@context": "https://schema.org", "@type": "ContactPage", name: "Contact", url: abs("/contact") }]} />
    </>
  );
}
