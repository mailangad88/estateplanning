import type { Metadata } from "next";
import Link from "next/link";
import { firm, LAUNCH_STATE, servedStates, SITE_DISCLAIMER } from "@/config/firm";
import { Rich, RichFaqList } from "@/components/money-page";
import { Breadcrumbs, ReviewNote } from "@/components/ui";
import { PageHero } from "@/components/page-hero";
import { abs, breadcrumbLd, JsonLd } from "@/lib/seo";
import BookFlow from "./BookFlow";

export const metadata: Metadata = {
  title: "Book a consultation with an estate planning attorney",
  description: "Pick a time to talk with an estate planning attorney in Illinois or New Jersey about a will, trust, powers of attorney or settling an estate. We match you with an appropriate attorney in our network.",
  alternates: { canonical: "/book" },
};

const STEPS = [
  { title: "You tell us what is going on", body: "Your family, what you own, and what worries you. No documents needed. We use it to match you with the right attorney." },
  { title: "The attorney explains your options", body: "In plain English, including when a simpler plan is enough." },
  { title: "You get a flat-fee quote", body: "If you want help, you leave with a price and a timeline. You do not have to decide on the call." },
];

const FAQS = [
  { q: "What does the consult cost?", a: `${firm.consultFee}. Package prices are on our [pricing page](/pricing), so you can see them before you book.` },
  { q: "How long is it, and how do we meet?", a: `${firm.consultLength} minutes, by ${firm.consultFormat}.` },
  { q: "Do I have to sign up for anything on the call?", a: "No. You can take the quote home, think it over, and come back when you are ready." },
  { q: "Who will I talk to?", a: "An estate planning attorney in our network who is licensed in your state and fits what you need. We match you based on where you live and the kind of help you are looking for." },
  { q: "Is this a law firm?", a: "No. This is a referral website: we match you with an appropriate attorney, and that attorney gives the legal advice." },
  { q: "What if I just want to learn first?", a: "Try the [plan finder](/plan-finder), the [will or trust comparison](/tools/will-or-trust) or our [free guides](/guides). Booking is there when you want it." },
  { q: "Is what I say on the call confidential?", a: "Please do not share account numbers or Social Security numbers. Booking a consult does not by itself create an attorney-client relationship; that starts when you and the attorney sign an engagement agreement. What you tell an attorney while seeking legal help is generally kept confidential under Rule 1.18 of the Illinois and New Jersey Rules of Professional Conduct." },
];

export default function BookPage() {
  const served = servedStates();
  const defaultState = served.includes(LAUNCH_STATE.abbr) ? LAUNCH_STATE.abbr : "";
  const digits = firm.phone.replace(/\D/g, "");
  return (
    <>
      <PageHero
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Book a consult" }]} />}
        kicker="Book a consult"
        path="/book"
        art="SpotVideoCall"
        title="Book a call with an estate planning attorney"
        lead="Pick a time below and we will match you with an appropriate estate planning attorney in our Illinois and New Jersey network. No questionnaire first."
      >
        <ReviewNote reviewed={false} updated="October 2026" />
        <ul className="book-facts" aria-label="About the consult">
          <li><Rich text={`${firm.consultLength} minutes`} /></li>
          <li><Rich text={firm.consultFormat} /></li>
          <li><Rich text={firm.consultFee} /></li>
          <li>Flat-fee quote, no obligation</li>
        </ul>
      </PageHero>

      <div className="book-layout">
        <div>
          <BookFlow servedStates={served} defaultState={defaultState} />
        </div>
        <aside aria-label="What to expect">
          <h2>What happens on the call</h2>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.title}><strong>{s.title}</strong><br />{s.body}</li>
            ))}
          </ol>
          <h2>Rather talk now?</h2>
          <p>
            Call <a href={`tel:${digits}`}>{firm.phone}</a> ({firm.officeHours}). If someone has just died or a family member is in the
            hospital, call and tell us that first.
          </p>
          <p>
            Prices first? See <Link href="/pricing">flat-fee packages</Link> and <Link href="/how-it-works">how it works</Link>.
          </p>
        </aside>
      </div>

      <RichFaqList faqs={FAQS} />
      <p className="notice">
        Attorney advertising. {SITE_DISCLAIMER} Booking a call does not by itself create an attorney-client relationship.
      </p>
      <JsonLd data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Book a consult", path: "/book" }]), { "@context": "https://schema.org", "@type": "ContactPage", name: "Book a consult", url: abs("/book") }]} />
    </>
  );
}
