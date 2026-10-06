import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { firm } from "@/config/firm";
import { bySlug, getAudiences } from "@/lib/content";
import { resolveAll } from "@/lib/links";
import { ArticlePage } from "@/components/article";
import { JsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAudiences().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = bySlug(getAudiences(), slug);
  if (!a) return {};
  return { title: a.title, description: a.description, alternates: { canonical: `/estate-planning-for/${a.slug}` } };
}

export default async function AudiencePage({ params }: Props) {
  const { slug } = await params;
  const a = bySlug(getAudiences(), slug);
  if (!a) notFound();
  const path = `/estate-planning-for/${a.slug}`;
  const digits = firm.phone.replace(/\D/g, "");
  // Sensitive pages send visitors to the contact page, not the quiz, so no health or family answers are collected.
  const bookHref = a.sensitive ? "/contact" : "/plan-finder";
  return (
    <ArticlePage
      section={{ name: "Estate planning by situation", path: "/estate-planning-for" }}
      path={path}
      title={a.title}
      heading={a.headline}
      description={a.description}
      answer={a.answer}
      updated={a.updated}
      reviewed={a.reviewed}
      html={a.html}
      headings={a.headings}
      faqs={a.faqs}
      sensitive={a.sensitive}
      before={
        <>
          <p className="no-print">
            <a className="button" href={`tel:${digits}`}>Call {firm.phone}</a>{" "}
            <Link className="button" href={bookHref}>Book a consultation</Link>
          </p>
          {a.hooks.length > 0 && (
            <ul>
              {a.hooks.map((h) => <li key={h}>{h}</li>)}
            </ul>
          )}
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "Service",
              name: a.title,
              serviceType: "Estate planning",
              provider: { "@type": "LegalService", name: firm.firmLegalName },
            }}
          />
        </>
      }
      magnet={a.magnet ? { interest: a.slug, ...a.magnet } : undefined}
      related={resolveAll(a.related)}
    />
  );
}
