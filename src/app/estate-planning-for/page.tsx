import type { Metadata } from "next";
import { getAudiences } from "@/lib/content";
import { CardGrid, Cta, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Estate planning by situation",
  description: "Planning pages for caregivers, new parents, executors, business owners, blended families, retirees and more.",
  alternates: { canonical: "/estate-planning-for" },
};

export default function AudienceHub() {
  return (
    <>
      <PageHeader title="Estate planning by situation" lead="Pick the page closest to your situation. Each one covers what is commonly at stake, what a plan usually includes, and what we do not do." />
      <CardGrid items={getAudiences().map((a) => ({ href: `/estate-planning-for/${a.slug}`, title: a.title, description: a.description }))} />
      <Cta />
    </>
  );
}
