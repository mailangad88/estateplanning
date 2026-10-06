import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AnswerBox from "@/components/AnswerBox";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import Faqs from "@/components/Faqs";
import JsonLd from "@/components/JsonLd";
import LinkList from "@/components/LinkList";
import PageMeta from "@/components/PageMeta";
import Toc from "@/components/Toc";
import { getCluster, getClusterArticles, getClusters, getPillar } from "@/lib/library";
import { siteLinksFor } from "@/lib/site-links";
import { articleSchema, breadcrumbSchema, faqSchema, graph, itemListSchema } from "@/lib/schema";

type Params = { cluster: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return getClusters()
    .filter((c) => getPillar(c.slug))
    .map((c) => ({ cluster: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { cluster } = await params;
  const p = getPillar(cluster);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: p.url, types: { "text/markdown": `/raw${p.url}.md` } },
    openGraph: { type: "article", title: p.title, description: p.description, url: p.url, modifiedTime: p.updated },
  };
}

export default async function PillarPage({ params }: { params: Promise<Params> }) {
  const { cluster: slug } = await params;
  const cluster = getCluster(slug);
  const p = getPillar(slug);
  if (!cluster || !p) notFound();

  const articles = getClusterArticles(slug);
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Learn", url: "/learn" },
    { name: cluster.name, url: cluster.url },
  ];
  const otherClusters = getClusters().filter((c) => c.slug !== slug && getPillar(c.slug));

  return (
    <article className="content">
      <JsonLd
        data={graph(
          articleSchema(p),
          breadcrumbSchema(crumbs),
          faqSchema(p.faqs),
          itemListSchema(`${cluster.name} guides`, articles.map((a) => ({ name: a.title, url: a.url }))),
        )}
      />
      <Breadcrumbs items={crumbs} />
      <h1>{p.title}</h1>
      <PageMeta updated={p.updated} words={p.wordCount} />
      <AnswerBox answer={p.answer} takeaways={p.takeaways} />
      <LinkList
        id="in-this-guide"
        title={`${cluster.name}: every guide`}
        items={articles.map((a) => ({ url: a.url, title: a.title, description: a.description }))}
      />
      <Toc headings={p.headings} />
      <div className="prose" dangerouslySetInnerHTML={{ __html: p.html }} />
      <Faqs faqs={p.faqs} />
      <CtaBox topic={cluster.name} />
      <LinkList
        id="more-on-topic"
        title={`More on ${cluster.name.toLowerCase()}: guides, comparisons and quick answers`}
        items={siteLinksFor(slug).map((l) => ({ url: l.url, title: l.title, description: l.kind }))}
      />
      <nav className="topic-nav" aria-labelledby="more-topics">
        <h2 id="more-topics">More estate planning topics</h2>
        <ul className="chips">
          {otherClusters.map((c) => (
            <li key={c.slug}><Link href={c.url}>{c.name}</Link></li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
