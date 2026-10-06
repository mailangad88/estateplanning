import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bySlug, getComparisons } from "@/lib/content";
import { resolveAll } from "@/lib/links";
import { ArticlePage } from "@/components/article";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getComparisons().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = bySlug(getComparisons(), (await params).slug);
  if (!c) return {};
  return { title: c.title, description: c.description, alternates: { canonical: `/compare/${c.slug}` } };
}

export default async function ComparePage({ params }: Props) {
  const c = bySlug(getComparisons(), (await params).slug);
  if (!c) notFound();
  const others = getComparisons().filter((x) => x.slug !== c.slug).slice(0, 3).map((x) => x.slug);
  return (
    <ArticlePage
      section={{ name: "Comparisons", path: "/compare" }}
      path={`/compare/${c.slug}`}
      title={c.title}
      description={c.description}
      answer={c.answer || c.verdict}
      updated={c.updated}
      reviewed={c.reviewed}
      html={c.html}
      headings={c.headings}
      faqs={c.faqs}
      related={resolveAll([...c.related, ...others])}
    />
  );
}
