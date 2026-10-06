import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AnswerBox from "@/components/AnswerBox";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import Faqs from "@/components/Faqs";
import JsonLd from "@/components/JsonLd";
import { PageHero } from "@/components/page-hero";
import LinkList from "@/components/LinkList";
import PageMeta from "@/components/PageMeta";
import Toc from "@/components/Toc";
import { getAllArticles, getArticle, getCluster, getGlossaryEntry, getRelated , isIndexable } from "@/lib/library";
import ToolsBox from "@/components/ToolsBox";
import { RichProse } from "@/components/embeds/rich-prose";
import { isSensitiveLibraryPage, magnetsForLibrary, siteLinksFor, toolsFor } from "@/lib/site-links";
import MagnetOptIn from "@/components/MagnetOptIn";
import { PageMedia } from "@/components/visuals/PageMedia";
import { SensitiveMarker } from "@/components/capture";
import { MAGNET_FORMATS } from "@/lib/magnets";
import { articleSchema, breadcrumbSchema, faqSchema, graph } from "@/lib/schema";

type Params = { cluster: string; slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return getAllArticles()
    .filter((a) => a.kind === "article")
    .map((a) => ({ cluster: a.cluster, slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { cluster, slug } = await params;
  const a = getArticle(cluster, slug);
  if (!a) return {};
  return {
    title: a.title,
    description: a.description,
    alternates: { canonical: a.url, types: { "text/markdown": `/raw${a.url}.md` } },
    robots: isIndexable(a) ? undefined : { index: false, follow: true },
    openGraph: { type: "article", title: a.title, description: a.description, url: a.url, modifiedTime: a.updated },
  };
}

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { cluster: clusterSlug, slug } = await params;
  const a = getArticle(clusterSlug, slug);
  const cluster = getCluster(clusterSlug);
  if (!a || !cluster) notFound();

  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Learn", url: "/learn" },
    { name: cluster.name, url: cluster.url },
    { name: a.title, url: a.url },
  ];
  const related = getRelated(a);
  const terms = a.glossary.map(getGlossaryEntry).filter((g) => g !== undefined);
  const sensitive = isSensitiveLibraryPage(clusterSlug, slug);
  const offers = magnetsForLibrary(a.url, clusterSlug);
  const lead = sensitive ? undefined : offers[0];
  const moreOffers = lead ? offers.slice(1) : offers;

  return (
    <article className="content">
      <JsonLd data={graph(articleSchema(a), breadcrumbSchema(crumbs), faqSchema(a.faqs))} />
      <PageHero compact crumbs={<Breadcrumbs items={crumbs} />} kicker={cluster.name} path={a.url} title={a.title}>
        <PageMeta updated={a.updated} words={a.wordCount} reviewed={a.review === "approved"} />
      </PageHero>
      <AnswerBox answer={a.answer} takeaways={a.takeaways} />
      <PageMedia path={a.url} />
      <Toc headings={a.headings} />
      <RichProse
        html={a.html}
        path={a.url}
        title={a.title}
        sensitive={sensitive}
        explicit={a.visuals}
        downloads={moreOffers.map((o) => ({ slug: o.slug, title: o.title, promise: o.promise }))}
        tools={toolsFor(clusterSlug).map((t) => ({ href: t.url, title: t.title }))}
        related={siteLinksFor(clusterSlug).map((l) => ({ href: l.url, title: l.title, kind: l.kind }))}
      />
      <ToolsBox items={toolsFor(clusterSlug)} />
      <Faqs faqs={a.faqs} />
      {sensitive && <SensitiveMarker />}
      {lead && (
        <section className="magnet-callout">
          <MagnetOptIn
            magnet={{ slug: lead.slug, title: lead.title, format: lead.format, formatLabel: MAGNET_FORMATS[lead.format], tag: lead.tag, sequence: lead.sequence }}
            heading={`Free ${MAGNET_FORMATS[lead.format].toLowerCase()}: ${lead.title}`}
          />
        </section>
      )}
      {moreOffers.length > 0 && (
        <section aria-labelledby="free-resources">
          <h2 id="free-resources">{lead ? "More free resources on this topic" : "Free resources on this topic"}</h2>
          <ul className="cards">
            {moreOffers.map((o) => (
              <li key={o.slug}>
                <Link href={`/free/${o.slug}`} className="card-link">
                  <span className="tag">Free {MAGNET_FORMATS[o.format].toLowerCase()}</span>
                  <strong>{o.title}</strong>
                  <span className="card-desc">{o.promise}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <CtaBox topic={cluster.name} />
      {terms.length > 0 && (
        <section className="terms" aria-labelledby="terms">
          <h2 id="terms">Terms used on this page</h2>
          <dl>
            {terms.map((g) => (
              <div key={g.slug}>
                <dt><Link href={g.url}>{g.term}</Link></dt>
                <dd>{g.short}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <LinkList
        id="related"
        title="Keep reading"
        items={[
          ...related.map((r) => ({ url: r.url, title: r.title, description: r.description })),
          ...siteLinksFor(clusterSlug).slice(0, 3).map((l) => ({ url: l.url, title: l.title, description: l.kind })),
        ]}
      />
      <p className="back-to-pillar">
        Part of our guide: <Link href={cluster.url}>{cluster.pillarTitle}</Link>. Rules differ by state, so see{" "}
        <Link href="/estate-planning">estate planning laws by state</Link>.
      </p>
    </article>
  );
}
