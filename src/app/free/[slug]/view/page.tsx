import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { Prose, ReviewNote } from "@/components/ui";
import { firm } from "@/config/firm";
import { MAGNET_FORMATS, getMagnet, getMagnets } from "@/lib/magnets";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getMagnets().map((m) => ({ slug: m.slug }));
}

/** Opened after the opt-in or from the delivery email, so it stays out of search results. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = getMagnet((await params).slug);
  return { title: m?.title, robots: { index: false, follow: false } };
}

export default async function MagnetView({ params }: Props) {
  const m = getMagnet((await params).slug);
  if (!m) notFound();
  return (
    <article className="magnet-view">
      <p className="no-print"><Link href={`/free/${m.slug}`}>← {m.title}</Link></p>
      <p className="no-print"><PrintButton /> <span className="notice">Choose &quot;Save as PDF&quot; in the print window to keep a copy.</span></p>
      <p className="tag">{MAGNET_FORMATS[m.format]}</p>
      <h1>{m.title}</h1>
      <p className="lead">{m.promise}</p>
      <ReviewNote reviewed={m.reviewed} updated={m.updated} />
      {m.format === "email-course" ? (
        m.lessons.map((l) => (
          <section key={l.day} className="lesson">
            <h2>Day {l.day}: {l.subject}</h2>
            <Prose html={l.html} />
          </section>
        ))
      ) : (
        <Prose html={m.html} />
      )}
      <hr />
      <p className="notice">
        Attorney advertising. Prepared by {firm.firmLegalName}. General information only, not legal advice. Laws vary by
        state and change over time. Using this resource does not create an attorney-client relationship.
      </p>
      {m.sequence === "B" && (
        <p className="no-print">Questions about your own plan? <Link href="/plan-finder">Book a consult</Link>.</p>
      )}
    </article>
  );
}
