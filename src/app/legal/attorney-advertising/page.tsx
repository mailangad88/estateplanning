import type { Metadata } from "next";
import Link from "next/link";
import { firm, servedStates } from "@/config/firm";
import { rulesFor } from "@/config/compliance";
import { REVIEW_POLICY } from "@/config/reviews";
import { Disclosures, ResultsNote } from "@/components/Disclosures";

export const metadata: Metadata = {
  title: "Attorney advertising notice",
  description: "Who is responsible for this website, where the attorney is licensed, and the rules we follow for advertising, fees and testimonials.",
  alternates: { canonical: "/legal/attorney-advertising" },
};

// DRAFT: must be reviewed and approved by the attorney before launch (backlog B4).
export default function AttorneyAdvertising() {
  const rules = rulesFor(servedStates());
  const bio = firm.attorneyBio;
  return (
    <>
      <h1>Attorney advertising notice</h1>
      <p className="notice">Draft pending attorney review.</p>
      <p>
        This website is attorney advertising for {firm.firmLegalName}. {firm.brandName} is the firm&apos;s own client education and
        intake team, not a lawyer referral service.
      </p>

      <h2>Responsible attorney</h2>
      <ul>
        <li>Name: {firm.attorneyName}, {firm.attorneyTitle.toLowerCase()}</li>
        <li>Bar number: {firm.barNumber}</li>
        <li>Admitted to practice: {bio.licensedIn}</li>
        <li>Education: {bio.education}</li>
        <li>{bio.practiceFocus}</li>
        {bio.certification && <li>Certification: {bio.certification}</li>}
        <li>Office: {firm.officeAddress} ({firm.officeLocality})</li>
        <li>Phone: {firm.phone}</li>
      </ul>
      <p>
        The firm offers legal services only in the states where its attorneys are licensed. Pages that describe another
        state&apos;s law are general information, and we do not take matters in states where we are not licensed.
      </p>

      <h2>Not legal advice; no attorney-client relationship</h2>
      <p>
        Everything on this site is general education. It is not legal advice and may not fit your situation. Reading the site,
        using a tool, submitting a form, texting or calling us does not create an attorney-client relationship. That relationship
        begins only when you and the firm sign an engagement agreement. Until then, please do not send confidential details.
      </p>

      <h2>No promise of results</h2>
      <ResultsNote className="" />
      <p>We do not publish case results. Fees, timelines and outcomes depend on your family, your assets and the law of your state.</p>

      <h2>Fees we advertise</h2>
      <p>
        Where a price is shown, the page says what is and is not included and when it was last updated. Court filing fees, recording
        fees and third-party costs are extra unless the page says otherwise. You receive a written flat-fee quote before you hire the
        firm. See <Link href="/pricing">pricing</Link>.
      </p>

      <h2>Reviews and testimonials</h2>
      <ul>
        {REVIEW_POLICY.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
        <li>We do not display star ratings or rating markup collected on our own site.</li>
      </ul>

      <h2>Words we do not use</h2>
      <p>
        We do not describe our attorneys with credential or ranking words the bar rules restrict, and we do not claim a
        certification unless the attorney holds it and the certifying body and practice area are named.
      </p>

      <h2>Texts, emails and AI tools</h2>
      <p>
        Marketing emails and texts to people who are not clients are labeled as advertising, include the firm&apos;s address and an
        easy opt-out, and are sent only with consent. Some draft content on this site was prepared with the help of AI writing tools;
        no page is presented as reviewed until the attorney has reviewed it. See our <Link href="/editorial-policy">editorial policy</Link> and{" "}
        <Link href="/editorial-policy/review-log">content review log</Link>.
      </p>

      <h2>Records</h2>
      <p>
        We keep dated copies of every published page version, ad, email template and where each ran for at least{" "}
        {rules.retentionYears} years.
      </p>

      <h2>Required disclosures</h2>
      <Disclosures variant="page" />
    </>
  );
}
