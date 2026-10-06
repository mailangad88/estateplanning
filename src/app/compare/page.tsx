import type { Metadata } from "next";
import { getComparisons } from "@/lib/content";
import { CardGrid, Cta, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Estate planning comparisons",
  description: "Side-by-side comparisons of wills, trusts, powers of attorney and other estate planning options.",
  alternates: { canonical: "/compare" },
};

export default function CompareIndex() {
  return (
    <>
      <PageHeader kicker="Compare your options" art="HeroTrusts" title="Side-by-side comparisons" lead="The choices families weigh most often, compared factor by factor." />
      <CardGrid items={getComparisons().map((c) => ({ href: `/compare/${c.slug}`, title: c.title, description: c.description, tag: `${c.optionA} vs ${c.optionB}` }))} />
      <Cta />
    </>
  );
}
