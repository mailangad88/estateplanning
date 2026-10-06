import type { Metadata } from "next";
import { getLifeEvents } from "@/lib/content";
import { CardGrid, Cta, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Estate planning for life's big moments",
  description: "What to put in place after a new baby, marriage, divorce, a new home, retirement and other life changes.",
  alternates: { canonical: "/life-events" },
};

export default function LifeEventsIndex() {
  return (
    <>
      <PageHeader kicker="Life events" art="HeroFamilyHome" title="Planning for life's big moments" lead="Most people start or update an estate plan because something in life changed. Find yours." />
      <CardGrid items={getLifeEvents().map((l) => ({ href: `/life-events/${l.slug}`, title: l.title, description: l.description, tag: l.event }))} />
      <Cta />
    </>
  );
}
