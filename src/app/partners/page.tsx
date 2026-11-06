import type { Metadata } from "next";
import Link from "next/link";
import { firm } from "@/config/firm";
import { PARTNER_PAGE_FOOTER } from "@/lib/partners";
import { Cta, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Working with referral partners",
  description: `How ${firm.brandName} works with CPAs, advisors and other professionals who may refer clients: no payment, disclosure to every client, and no client information shared without a release.`,
  alternates: { canonical: "/partners" },
};

export default function PartnersIndex() {
  return (
    <>
      <PageHeader
        kicker="Referral partners"
        art="SpotVideoCall"
        path="/partners"
        title="Working with referral partners"
        lead="Professionals who work with families sometimes suggest an estate planning attorney. This is how we handle that, so nothing about it can surprise you, your compliance team or a client."
      />
      <h2>Our rules</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th scope="col">Rule</th><th scope="col">What it means</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">No payment, ever</th><td>We do not pay or accept anything for a referral, and we do not share legal fees with anyone who is not a lawyer at the firm.</td></tr>
            <tr><th scope="row">Disclosure</th><td>Every referred client is told in writing who referred them and that no money changes hands. The arrangement is not exclusive and clients may choose any lawyer.</td></tr>
            <tr><th scope="row">Confidentiality</th><td>We do not tell a partner whether a person contacted us, booked or hired us unless that person signs a release. Without one, the answer is a thank-you.</td></tr>
            <tr><th scope="row">Gifts</th><td>Token items only, logged, never tied to a referral.</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        To arrange a co-branded page with a referral form for your practice, <Link href="/contact">contact us</Link>.
      </p>
      <Cta from="partners" title="Have a client who needs a plan?" body="They can book a consult directly. We tell them in writing who referred them." />
      <p className="notice">{firm.brandName} {PARTNER_PAGE_FOOTER}</p>
    </>
  );
}
