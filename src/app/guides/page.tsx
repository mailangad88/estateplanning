import type { Metadata } from "next";
import { GUIDE_CATEGORIES, getGuides } from "@/lib/content";
import { CardGrid, Cta, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Estate planning guides",
  description: "Plain-English guides to wills, trusts, powers of attorney, probate and more, written for families.",
  alternates: { canonical: "/guides" },
};

export default function GuidesIndex() {
  const guides = getGuides();
  return (
    <>
      <PageHeader kicker="Guides" art="HeroWills" title="Estate planning guides" lead="Plain-English explanations of how each part of an estate plan works, the steps involved and the mistakes to avoid." />
      {Object.entries(GUIDE_CATEGORIES).map(([key, label]) => {
        const items = guides.filter((g) => g.category === key);
        if (!items.length) return null;
        return (
          <section key={key}>
            <h2>{label}</h2>
            <CardGrid items={items.map((g) => ({ href: `/guides/${g.slug}`, title: g.title, description: g.description, tag: `${g.readingMinutes} min read` }))} />
          </section>
        );
      })}
      <Cta />
    </>
  );
}
