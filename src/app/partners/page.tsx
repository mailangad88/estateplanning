import type { Metadata } from "next";
import Link from "next/link";
import { firm } from "@/config/firm";
import { PARTNER_PAGE_FOOTER } from "@/lib/partners";

export const metadata: Metadata = {
  title: "Working with referral partners",
  description: `How ${firm.brandName} works with CPAs, advisors and other professionals who may refer clients: no payment, disclosure to every client, and no client information shared without a release.`,
  alternates: { canonical: "/partners" },
};

export default function PartnersIndex() {
  return (
    <>
      <h1>Working with referral partners</h1>
      <p className="lead">
        Professionals who work with families sometimes suggest an estate planning attorney. This is how we handle that, so nothing about it can surprise you,
        your compliance team or a client.
      </p>
      <h2>Our rules</h2>
      <ul>
        <li><strong>No payment, ever.</strong> We do not pay or accept anything for a referral, and we do not share legal fees with anyone who is not a lawyer at the firm.</li>
        <li><strong>Disclosure.</strong> Every referred client is told in writing who referred them and that no money changes hands. The arrangement is not exclusive and clients may choose any lawyer.</li>
        <li><strong>Confidentiality.</strong> We do not tell a partner whether a person contacted us, booked or hired us unless that person signs a release. Without one, the answer is a thank-you.</li>
        <li><strong>Gifts.</strong> Token items only, logged, never tied to a referral.</li>
      </ul>
      <p>
        To arrange a co-branded page with a referral form for your practice, <Link href="/contact">contact us</Link>.
      </p>
      <p className="notice">{firm.brandName} {PARTNER_PAGE_FOOTER}</p>
    </>
  );
}
