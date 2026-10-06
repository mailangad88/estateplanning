import type { Metadata } from "next";
import { getGuides, getPosts } from "@/lib/content";
import { CardGrid, Cta, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Estate planning questions, answered",
  description: "Short, direct answers to the specific estate planning questions families ask most.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  const posts = getPosts();
  const guides = getGuides();
  const byPillar = new Map<string, typeof posts>();
  for (const p of posts) byPillar.set(p.pillar, [...(byPillar.get(p.pillar) ?? []), p]);
  return (
    <>
      <PageHeader kicker="Quick answers" art="SpotQuestions" title="Questions, answered" lead="Short, direct answers to specific questions, each linked to the full guide on the topic." />
      {[...byPillar.entries()].map(([pillar, items]) => {
        const g = guides.find((x) => x.slug === pillar);
        return (
          <section key={pillar}>
            <h2>{g ? g.title : "More questions"}</h2>
            <CardGrid items={items.map((p) => ({ href: `/blog/${p.slug}`, title: p.title, description: p.description }))} />
          </section>
        );
      })}
      <Cta />
    </>
  );
}
