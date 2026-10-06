import type { Metadata } from "next";
import { getAudiences } from "@/lib/content";
import { LIFE_STAGES } from "@/config/life-stages";
import { Breadcrumbs, CardGrid, Cta } from "@/components/ui";
import { Band, SectionHead, StageGrid } from "@/components/landing";

export const metadata: Metadata = {
  title: "Estate planning by life stage and situation",
  description: "Planning pages for newlyweds, new parents, homeowners, blended families, pre-retirees, retirees, adult children of aging parents, executors, business owners and more.",
  alternates: { canonical: "/estate-planning-for" },
};

export default function AudienceHub() {
  const stageSlugs = new Set(LIFE_STAGES.map((s) => s.slug));
  const others = getAudiences().filter((a) => !stageSlugs.has(a.slug));
  return (
    <>
      <Band className="stage-hero stage-hero--accent" label="Life stages">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Estate planning by situation" }]} />
        <SectionHead
          kicker="Plans by life stage"
          title="Estate planning for where you are in life"
          lead="A plan for a newly married couple looks nothing like a plan for a retiree. Pick your stage to see what matters most, and what you can skip."
        />
        <StageGrid />
      </Band>
      <h2>Other situations</h2>
      <p>Each page covers what is commonly at stake, what a plan usually includes, and what we do not do.</p>
      <CardGrid items={others.map((a) => ({ href: `/estate-planning-for/${a.slug}`, title: a.title, description: a.description }))} />
      <Cta />
    </>
  );
}
