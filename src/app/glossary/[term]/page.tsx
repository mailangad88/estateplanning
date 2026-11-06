import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import JsonLd from "@/components/JsonLd";
import { PageHero } from "@/components/page-hero";
import LinkList from "@/components/LinkList";
import PageMeta from "@/components/PageMeta";
import { KitFaqs, TopicDiagram } from "@/components/page-kit";
import { RichProse } from "@/components/embeds/rich-prose";
import { diagramFor } from "@/lib/page-faqs";
import { findByUrl, getBacklinks, getGlossary, getGlossaryEntry, refToUrl } from "@/lib/library";
import { breadcrumbSchema, definedTermSchema, graph } from "@/lib/schema";

type Params = { term: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return getGlossary().map((g) => ({ term: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { term } = await params;
  const g = getGlossaryEntry(term);
  if (!g) return {};
  const title = g.term.length <= 22 ? `${g.term}: meaning in estate planning, with an example` : `${g.term}: meaning and example`;
  return {
    title,
    description: g.short.length > 160 ? `${g.short.slice(0, 157)}...` : g.short,
    alternates: { canonical: g.url, types: { "text/markdown": `/raw${g.url}.md` } },
  };
}

export default async function TermPage({ params }: { params: Promise<Params> }) {
  const { term } = await params;
  const g = getGlossaryEntry(term);
  if (!g) notFound();

  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Glossary", url: "/glossary" },
    { name: g.term, url: g.url },
  ];
  const seeAlso = g.seeAlso.map(getGlossaryEntry).filter((x) => x !== undefined);
  const guides = g.related
    .map((r) => findByUrl(refToUrl(r)))
    .filter((x) => x !== undefined && "title" in x)
    .map((x) => x as { url: string; title: string; description: string });
  const mentionedIn = getBacklinks(g.url).filter((p) => !guides.some((x) => x.url === p.url)).slice(0, 8);
  // The term, its other names and the guides it points to say what the page is about.
  const topic = [g.term, g.slug, ...g.also, ...g.related, ...g.seeAlso].join(" ");
  const clusters = g.related.map((r) => r.split("/")[0]);
  const diagram = diagramFor(topic);

  return (
    <article className="content">
      <JsonLd data={graph(definedTermSchema(g), breadcrumbSchema(crumbs))} />
      <PageHero compact crumbs={<Breadcrumbs items={crumbs} />} kicker="Glossary term" path={g.url} title={g.term}>
        <PageMeta updated="" />
      </PageHero>
      <section className="answer-box" aria-label="Definition">
        <h2 className="answer-label">Definition</h2>
        <p className="answer">{g.short}</p>
        {g.also.length > 0 && <p className="desc">Also called: {g.also.join(", ")}.</p>}
      </section>
      <TopicDiagram topic={topic} />
      <RichProse
        html={g.html}
        path={guides[0]?.url ?? g.url}
        title={`${g.term} ${guides.map((x) => x.title).join(" ")}`}
        excludeDiagrams={diagram ? [diagram.name] : []}
      />
      {seeAlso.length > 0 && (
        <nav aria-labelledby="see-also">
          <h2 id="see-also">Related terms</h2>
          <ul className="chips">
            {seeAlso.map((s) => (
              <li key={s.slug}><Link href={s.url}>{s.term}</Link></li>
            ))}
          </ul>
        </nav>
      )}
      <LinkList
        id="guides"
        title="Guides that explain this"
        items={[...guides, ...mentionedIn].map((x) => ({ url: x.url, title: x.title }))}
      />
      <KitFaqs url={g.url} topic={g.term} context={topic} clusters={clusters} categories={["Getting started"]} title={`Questions people ask about ${g.term.toLowerCase()}`} />
      <CtaBox topic={g.term} from="glossary" />
    </article>
  );
}
