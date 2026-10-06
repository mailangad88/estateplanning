import Link from "next/link";
import { firm } from "@/config/firm";

const digits = (n: string) => n.replace(/\D/g, "");

/**
 * Sticky bar on phones: tap to call, tap to text, or ask for a call back.
 * Texting the firm first is the visitor's own choice, so it needs no SMS consent;
 * the reply from the firm stays within that conversation.
 */
export default function ContactBar() {
  const smsBody = encodeURIComponent("Hi, I have a question about estate planning.");
  return (
    <nav className="contact-bar" aria-label="Contact us">
      <a href={`tel:${digits(firm.phone)}`} className="contact-bar__item">
        <span aria-hidden="true">📞</span> Call
      </a>
      {firm.textNumber && (
        <a href={`sms:${digits(firm.textNumber)}?&body=${smsBody}`} className="contact-bar__item">
          <span aria-hidden="true">💬</span> Text
        </a>
      )}
      <Link href="/callback" className="contact-bar__item contact-bar__item--primary">
        Request a call back
      </Link>
    </nav>
  );
}
