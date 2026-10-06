import type { Metadata } from "next";
import { firm } from "@/config/firm";
import { Cta, PageHeader } from "@/components/ui";
import { Testimonials } from "@/components/Testimonials";

export const metadata: Metadata = {
  title: "About the firm",
  description: "Who we are, who we help and how we work.",
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <>
      <PageHeader title={`About ${firm.brandName}`} lead={`${firm.brandName} is the client education and intake team of ${firm.firmLegalName}.`} />
      <h2>{firm.attorneyName}</h2>
      <p>[Attorney bio, written from the brain-file interviews: why estate planning, who they help most, how they explain things, licensure, bar number {firm.barNumber}, education, community involvement. Include a short video introduction.]</p>
      <ul>
        <li>Admitted to practice: {firm.attorneyBio.licensedIn}</li>
        <li>Education: {firm.attorneyBio.education}</li>
        <li>{firm.attorneyBio.practiceFocus}</li>
        {firm.attorneyBio.certification && <li>Certification: {firm.attorneyBio.certification}</li>}
        {firm.attorneyBio.awards.map((a) => <li key={a}>{a}</li>)}
      </ul>
      <h2>How we work</h2>
      <ul>
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
