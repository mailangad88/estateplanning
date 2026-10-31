import type { Metadata } from "next";
import Link from "next/link";
import { firm, SERVED_AND, SERVED_OR } from "@/config/firm";
import { Cta, PageHeader } from "@/components/ui";
import { Rich } from "@/components/money-page";
import { Testimonials } from "@/components/Testimonials";

export const metadata: Metadata = {
  title: "About us",
  description: `Who we are, how the referral network works, and how we match you with an estate planning attorney in ${SERVED_OR}.`,
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <>
      <PageHeader
        kicker="About us"
        art="SpotVideoCall"
        title={`About ${firm.brandName}`}
        lead={`${firm.brandName} is a referral website. We match you with an appropriate estate planning attorney in our ${SERVED_AND} network.`}
      />
      <h2>{firm.attorneyName}</h2>
      <p>{firm.attorneyName} is the estate planning attorney responsible for this site. <Rich text={firm.attorneyShortBio} /></p>
      <ul>
        <li>Admitted to practice: <Rich text={firm.attorneyBio.licensedIn} /></li>
        <li>Education: <Rich text={firm.attorneyBio.education} /></li>
        <li>{firm.attorneyBio.practiceFocus}</li>
        {firm.attorneyBio.certification && <li>Certification: {firm.attorneyBio.certification}</li>}
        {firm.attorneyBio.awards.map((a) => <li key={a}>{a}</li>)}
      </ul>
      <p>
        See the full <Link href="/about-the-attorney">attorney profile</Link>.
      </p>
      <h2>How we work</h2>
      <ul>
        <li>We are a referral website, not a law firm. The attorney we match you with gives the legal advice.</li>
        <li>Plain-English explanations, no jargon.</li>
        <li>A written flat-fee quote before you sign anything.</li>
        <li>Your information is confidential and shared only with the attorney who may represent you.</li>
        <li>Our intake team are not lawyers and do not give legal advice; every plan is designed and signed off by an attorney.</li>
      </ul>
      <Testimonials />
      <Cta />
    </>
  );
}
