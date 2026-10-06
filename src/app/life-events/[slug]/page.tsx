import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bySlug, getLifeEvents } from "@/lib/content";
import { resolveAll } from "@/lib/links";
import { ArticlePage } from "@/components/article";
import { howToLd, JsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getLifeEvents().map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = bySlug(getLifeEvents(), (await params).slug);
  if (!l) return {};
  return { title: l.title, description: l.description, alternates: { canonical: `/life-events/${l.slug}` } };
}

export default async function LifeEventPage({ params }: Props) {
  const l = bySlug(getLifeEvents(), (await params).slug);
  if (!l) notFound();
  return (
    <ArticlePage
      section={{ name: "Life events", path: "/life-events" }}
      path={`/life-events/${l.slug}`}
      title={l.title}
      description={l.description}
      answer={l.answer}
      updated={l.updated}
      reviewed={l.reviewed}
      html={l.html}
      headings={l.headings}
      before={
        l.checklist.length > 0 ? (
          <section className="tool">
            <h2 style={{ marginTop: 0 }}>Your checklist</h2>
            <ul>{l.checklist.map((c) => <li key={c}>{c}</li>)}</ul>
            <JsonLd data={howToLd({ name: l.title, description: l.description, steps: l.checklist.map((c) => ({ name: c, text: c })) })} />
          </section>
        ) : null
      }
      magnet={{ interest: `life-event:${l.slug}`, title: `Email me the ${l.event.toLowerCase()} checklist`, body: "A printable version of this checklist, plus a reminder to review it in a year." }}
      related={resolveAll(l.related)}
    />
  );
}
