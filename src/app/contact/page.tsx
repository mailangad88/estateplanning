import type { Metadata } from "next";
import Link from "next/link";
import { firm } from "@/config/firm";
import { CallbackForm } from "@/components/capture";
import { Rich, RichFaqList } from "@/components/money-page";
import { Breadcrumbs, ReviewNote } from "@/components/ui";
import { abs, breadcrumbLd, JsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact us",
  description: `Call, text, request a call back or book a consultation with ${firm.attorneyName}. Office address, hours, and what to expect when you reach out about a will, trust or probate.`,
  alternates: { canonical: "/contact" },
};

const FAQS = [
  { q: "Will someone call me back if I leave a message?", a: `That is our aim. Stated response time: ${firm.responseTime}.` },
  { q: "Do you take cases outside your state?", a: "We advise on the law of the state where the attorney is licensed. [Attorney: licensed states]. See [how it works](/how-it-works)." },
  { q: "I only want to know if a trust makes sense. Do I have to book?", a: "No. Try the [will or trust comparison](/tools/will-or-trust), read [living trusts](/living-trusts), or call with a quick question." },
  { q: "Can I text you?", a: "Only after you have opted in to text messages in our form. Please do not text sensitive information. See [text message terms](/legal/sms-terms)." },
  { q: "Is this a law firm or a referral service?", a: "This is the practice of the attorney named on [about the attorney](/about-the-attorney). We do not pay or accept referral fees. [Attorney: confirm]" },
  { q: "What should I tell you in the first message?", a: "Your name, how to reach you, the county you live in, and one sentence on what is happening. Skip details until we speak." },
];

export default function Contact() {
  const digits = firm.phone.replace(/\D/g, "");
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Contact" }]} />
      <h1>Talk to us</h1>
      <ReviewNote reviewed={false} updated="October 2026" />
      <div className="answer">
        <strong>In short</strong>
        The fastest way to reach us is by phone at {firm.phone}. You can also book a consultation online or request a call back, and a
        real person on our intake team will reply. Stated response time: {firm.responseTime}. If someone has just died or a family
        member is in the hospital, call, and tell us that first.
      </div>
      <p className="cta-row no-print">
        <a className="button" href={`tel:${digits}`}>Call {firm.phone}</a>
        <Link className="button secondary" href="/plan-finder">Book a consult</Link>
      </p>

      <h2>Choose how to reach us</h2>
      <ul className="cards">
        <li><a className="card-link" href={`tel:${digits}`}><span className="tag">Call</span><strong>{firm.phone}</strong><span className="card-desc">Talk now, or leave a message. Hours: {firm.officeHours}</span></a></li>
        {firm.textNumber && (
          <li><a className="card-link" href={`sms:${firm.textNumber.replace(/\D/g, "")}`}><span className="tag">Text</span><strong>{firm.textNumber}</strong><span className="card-desc">Text a question. Please leave out private details.</span></a></li>
        )}
        <li><Link className="card-link" href="/plan-finder"><span className="tag">Online</span><strong>Book a consult</strong><span className="card-desc">Two minutes of questions, then pick a time.</span></Link></li>
        <li><Link className="card-link" href="/plan-finder"><span className="tag">Not sure</span><strong>Start the plan finder</strong><span className="card-desc">See what people in your situation commonly plan for.</span></Link></li>
      </ul>

      <h2>Request a call back</h2>
      <CallbackForm />
      <p className="notice">
        Please do not include Social Security numbers, account numbers or medical details. Contacting us does not create an
        attorney-client relationship, and what you send may not be protected until we agree to represent you.
      </p>

      <h2>Office and hours</h2>
      <p><Rich text={`${firm.brandName}, ${firm.officeAddress}. Hours: ${firm.officeHours}. [Attorney: parking and accessibility]`} /></p>

      <h2>Who answers</h2>
      <p>Calls are answered by the attorney or a member of the team. The team cannot give legal advice until there is an engagement agreement, but they can tell you what we do and what it costs. See <Link href="/pricing">pricing</Link> and <Link href="/how-it-works">how it works</Link>.</p>

      <RichFaqList faqs={FAQS} />
      <JsonLd data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]), { "@context": "https://schema.org", "@type": "ContactPage", name: "Contact", url: abs("/contact") }]} />
    </>
  );
}
