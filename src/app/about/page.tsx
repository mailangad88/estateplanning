import type { Metadata } from "next";
import Link from "next/link";
import { firm, SERVED_AND, SERVED_OR } from "@/config/firm";
import { Cta, PageHeader } from "@/components/ui";
import { Testimonials } from "@/components/Testimonials";
import { KitFaqs, TopicDiagram } from "@/components/page-kit";

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
      <h2>Our attorneys</h2>
      <p>
        Read <Link href="/about-the-attorney">how we choose our attorneys</Link> and what to expect from your first call.
      </p>
      <h2>How we work</h2>
      <ul>
        <li>We are a referral website, not a law firm. The attorney we match you with gives the legal advice.</li>
        <li>Plain-English explanations, no jargon.</li>
        <li>A written flat-fee quote before you sign anything.</li>
        <li>Your information is confidential and shared only with the attorney who may represent you.</li>
        <li>Our intake team are not lawyers and do not give legal advice; every plan is designed and signed off by an attorney.</li>
      </ul>
      <h2>What happens when you reach out</h2>
      <TopicDiagram topic="planning process step by step" />
      <Testimonials />
      <KitFaqs url="/about" topic="referral attorney consult" categories={["Working with us", "Cost and process"]} title="Questions about how this works" />
      <Cta from="about" />
    </>
  );
}
