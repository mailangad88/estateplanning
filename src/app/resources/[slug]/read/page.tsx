import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { firm } from "@/config/firm";
import { GUIDES, findGuide } from "@/content/guides";
import PrintButton from "./PrintButton";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

/** Guides are opened after the form, so keep them out of search results. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGuide(slug);
  return { title: guide?.title, robots: { index: false, follow: false } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();
  return (
    <article className="guide">
      <p className="no-print"><PrintButton /> <span className="notice">Choose &quot;Save as PDF&quot; to keep a copy.</span></p>
      <h1>{guide.title}</h1>
      <p className="lead">{guide.summary}</p>
      {guide.sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.intro && <p>{s.intro}</p>}
          <ul className="checklist">
            {s.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
      <hr />
      <p className="notice">
        Attorney advertising. Prepared by {firm.firmLegalName}, {firm.officeAddress}. General information only, not legal
        advice. Laws vary by state and change over time. Reading this guide does not create an attorney-client relationship.
      </p>
      <p className="no-print">
        Questions about your own plan? <Link href="/intake">Book a consult</Link> or call {firm.phone}.
      </p>
    </article>
  );
}
