import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import JsonLd from "@/components/JsonLd";
import LinkList from "@/components/LinkList";
import PageMeta from "@/components/PageMeta";
import { findByUrl, getBacklinks, getGlossary, getGlossaryEntry, refToUrl } from "@/lib/content";
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
  const title = `${g.term}: meaning in estate planning, with an example`;
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

  return (
    <article className="content">
      <JsonLd data={graph(definedTermSchema(g), breadcrumbSchema(crumbs))} />
      <Breadcrumbs items={crumbs} />
      <h1>{g.term}</h1>
      <PageMeta updated="" />
      <section className="answer-box" aria-label="Definition">
        <h2 className="answer-label">Definition</h2>
        <p className="answer">{g.short}</p>
        {g.also.length > 0 && <p className="desc">Also called: {g.also.join(", ")}.</p>}
      </section>
      <div className="prose" dangerouslySetInnerHTML={{ __html: g.html }} />
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
      <CtaBox />
    </article>
  );
}
