import type { Metadata } from "next";
import Link from "next/link";
import { firm } from "@/config/firm";
import { CallbackForm } from "@/components/capture";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Call, text, request a call back or book an estate planning consult.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  const digits = firm.phone.replace(/\D/g, "");
  return (
    <>
      <PageHeader title="Talk to us" lead="Pick whatever is easiest. A real person on our intake team will get back to you." />
      <ul className="cards">
        <li><a className="card-link" href={`tel:${digits}`}><span className="tag">Call</span><strong>{firm.phone}</strong><span className="card-desc">Speak with our intake team.</span></a></li>
        <li><a className="card-link" href={`sms:${digits}`}><span className="tag">Text</span><strong>{firm.phone}</strong><span className="card-desc">Text us your question.</span></a></li>
        <li><Link className="card-link" href="/plan-finder"><span className="tag">Online</span><strong>Book a consult</strong><span className="card-desc">Two minutes of questions, then pick a time.</span></Link></li>
      </ul>
      <h2>Request a call back</h2>
      <CallbackForm />
      <p className="notice">Contacting us does not create an attorney-client relationship. Please do not send confidential details until we have confirmed there is no conflict of interest.</p>
    </>
  );
}
