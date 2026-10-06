import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { firm } from "@/config/firm";
import { PARTNER_PAGE_FOOTER, PARTNER_TYPE_LABELS, referralConsentText, shortDisclosure } from "@/lib/partners";
import { getDb } from "@/server/runtime";
import { findPublicPartner } from "@/server/services/partners";
import PartnerReferralForm from "../PartnerReferralForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const partner = await findPublicPartner(await getDb(), slug);
  return {
    title: partner ? `${partner.org} and ${firm.brandName}` : "Partner page",
    // Co-branded pages are for the partner's own clients and colleagues, not search results.
    robots: { index: false, follow: false },
  };
}

export default async function PartnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const partner = await findPublicPartner(await getDb(), slug);
  if (!partner) notFound();
  return (
    <>
      <h1>{partner.org} and {firm.brandName}</h1>
      <p className="lead">{PARTNER_TYPE_LABELS[partner.type]} · {partner.name}</p>
      <p>
        {partner.name} may suggest {firm.brandName} to clients who ask about wills, trusts or powers of attorney. You can reach us yourself at any time:{" "}
        <Link href="/intake">book a consult</Link> or call {firm.phone}.
      </p>
      <div className="notice">
        <strong>How this works.</strong> {shortDisclosure(partner.name, partner.org, firm.brandName)}
      </div>
      <h2>Are you a client&apos;s professional?</h2>
      <p>If the person you are referring has said yes, you can send their name and contact details here.</p>
      <PartnerReferralForm slug={partner.slug} consentText={referralConsentText(firm.brandName)} partnerOrg={partner.org} />
      <p className="notice">
        {firm.brandName} {PARTNER_PAGE_FOOTER} We do not tell a partner whether a person contacted us or hired us unless the person has signed a release.
      </p>
    </>
  );
}
