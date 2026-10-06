import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bySlug, getPosts } from "@/lib/content";
import { resolveAll } from "@/lib/links";
import { ArticlePage } from "@/components/article";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = bySlug(getPosts(), (await params).slug);
  if (!p) return {};
  return { title: p.title, description: p.description, alternates: { canonical: `/blog/${p.slug}` }, openGraph: { title: p.title, description: p.description, type: "article" } };
}

export default async function PostPage({ params }: Props) {
  const p = bySlug(getPosts(), (await params).slug);
  if (!p) notFound();
  const siblings = getPosts().filter((x) => x.pillar === p.pillar && x.slug !== p.slug).map((x) => x.slug);
  return (
    <ArticlePage
      section={{ name: "Questions", path: "/blog" }}
      path={`/blog/${p.slug}`}
      title={p.title}
      description={p.description}
      answer={p.answer}
      updated={p.updated}
      reviewed={p.reviewed}
      html={p.html}
      headings={p.headings}
      faqs={p.faqs}
      related={resolveAll([p.pillar, ...p.related, ...siblings], [`/blog/${p.slug}`]).slice(0, 6)}
    />
  );
}
