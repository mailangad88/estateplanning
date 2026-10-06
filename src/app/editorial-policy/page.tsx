import type { Metadata } from "next";
import Link from "next/link";
import { firm } from "@/config/firm";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "How we write and review our content",
  description: "Who writes our estate planning content, how an attorney reviews it, and how we keep it current.",
  alternates: { canonical: "/editorial-policy" },
};

export default function EditorialPolicy() {
  return (
    <>
      <PageHeader kicker="How we write" art="SpotDocumentsSigned" title="Editorial and review policy" lead="Every page on this site is meant to be accurate, specific and useful to a family deciding what to do." />
      <h2>Who writes it</h2>
      <p>Our content starts from recorded answers {firm.attorneyName} gave to the questions clients ask most. Editors turn those answers into articles in plain English. Software, including AI writing tools, may help with research, drafting and formatting. Nothing is marked reviewed until the attorney has checked and approved it; the <Link href="/editorial-policy/review-log">content review log</Link> shows each step and the status of every page.</p>
      <h2>Who reviews it</h2>
      <p>Each page is reviewed by {firm.attorneyName}, {firm.attorneyTitle.toLowerCase()} (bar number {firm.barNumber}). Pages show &quot;Draft pending attorney review&quot; until that review is done, and the review date once it is.</p>
      <h2>Keeping it current</h2>
      <p>Pages that cite dollar figures or deadlines are re-checked every January and whenever the law changes. Each page shows the date it was last updated.</p>
      <h2>What this content is not</h2>
      <p>It is general education, not legal advice. Laws differ by state, and the right plan depends on your family. Reading this site does not create an attorney-client relationship.</p>
      <h2>Corrections</h2>
      <p>If you spot an error, call {firm.phone}. We correct mistakes promptly and note significant corrections on the page.</p>
    </>
  );
}
