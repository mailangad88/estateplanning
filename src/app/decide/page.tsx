import type { Metadata } from "next";
import { DECISIONS, decisionPath } from "@/config/decisions";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs, CardGrid, Cta } from "@/components/ui";
import { KitFaqs } from "@/components/page-kit";
import { graph, itemListSchema } from "@/lib/schema";
import { JsonLd } from "@/lib/seo";

const TITLE = "Estate planning decision guides";
const DESCRIPTION = "Visual guides for the choices people get stuck on: which trust, which power of attorney, how to pass on your house and more. Answer a few questions and compare every option side by side.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/decide" },
};

export default function DecideHub() {
  return (
    <>
      <PageHero
        title="Which one should you pick?"
        lead={DESCRIPTION}
        kicker="Decision guides"
        art="SpotQuestions"
        tone="accent"
        path="/decide"
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Decision guides" }]} />}
      />
      <CardGrid
        items={DECISIONS.map((d) => ({ href: decisionPath(d.slug), title: d.h1, description: d.description, tag: `${d.options.length} options compared` }))}
        media="art"
      />
      <KitFaqs url="/decide" topic="will trust" context="which choose difference compare probate power attorney" categories={["Getting started", "Trusts"]} title="Questions people ask before they choose" />
      <Cta from="decide" title="Still not sure which one fits?" body="An attorney can look at your family and property and tell you which option fits, with a flat-fee quote first." />
      <JsonLd data={graph(itemListSchema(TITLE, DECISIONS.map((d) => ({ name: d.h1, url: decisionPath(d.slug) }))))} />
    </>
  );
}
