import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDE_CATEGORIES, bySlug, getGuides, getPosts } from "@/lib/content";
import { backlinksTo, resolveAll } from "@/lib/links";
import { ArticlePage } from "@/components/article";
import { CardGrid } from "@/components/ui";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = bySlug(getGuides(), (await params).slug);
  if (!g) return {};
  return { title: g.title, description: g.description, alternates: { canonical: `/guides/${g.slug}` }, openGraph: { title: g.title, description: g.description, type: "article" } };
}

export default async function GuidePage({ params }: Props) {
  const g = bySlug(getGuides(), (await params).slug);
  if (!g) notFound();
  const cluster = getPosts().filter((p) => p.pillar === g.slug);
  return (
    <ArticlePage
      section={{ name: "Guides", path: "/guides" }}
      path={`/guides/${g.slug}`}
      title={g.title}
      description={g.description}
      answer={g.answer}
      updated={g.updated}
      reviewed={g.reviewed}
      html={g.html}
      headings={g.headings}
      faqs={g.faqs}
      before={<p className="meta">{GUIDE_CATEGORIES[g.category] ?? g.category} · {g.readingMinutes} min read</p>}
      after={
        cluster.length > 0 ? (
          <section>
            <h2>Questions people ask about this</h2>
            <CardGrid items={cluster.map((p) => ({ href: `/blog/${p.slug}`, title: p.title, description: p.description }))} />
          </section>
        ) : null
      }
      magnet={{ interest: `guide:${g.slug}`, title: "Get this guide and our starter checklists by email", body: "A printable copy of this guide plus the checklists people use to prepare for a consult." }}
      related={[...resolveAll(g.related), ...backlinksTo(g.slug)].slice(0, 9)}
    />
  );
}
