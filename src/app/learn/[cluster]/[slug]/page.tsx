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
import { getAllArticles, getArticle, getCluster, getGlossaryEntry, getRelated , isIndexable } from "@/lib/library";
import ToolsBox from "@/components/ToolsBox";
import { siteLinksFor, toolsFor } from "@/lib/site-links";
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

  return (
    <article className="content">
      <JsonLd data={graph(articleSchema(a), breadcrumbSchema(crumbs), faqSchema(a.faqs))} />
      <Breadcrumbs items={crumbs} />
      <h1>{a.title}</h1>
      <PageMeta updated={a.updated} words={a.wordCount} reviewed={a.review === "approved"} />
      <AnswerBox answer={a.answer} takeaways={a.takeaways} />
      <Toc headings={a.headings} />
      <div className="prose" dangerouslySetInnerHTML={{ __html: a.html }} />
      <ToolsBox items={toolsFor(clusterSlug)} />
      <Faqs faqs={a.faqs} />
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
