import type { Metadata } from "next";
import { EXPLAINERS } from "@/explainers/data";
import { CardGrid, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Animated estate planning explainers",
  description: "Short animated explainers on probate, living trusts, dying without a will and what a complete plan includes.",
  alternates: { canonical: "/explainers" },
};

export default function ExplainersIndex() {
  return (
    <>
      <PageHeader kicker="Watch and learn" art="SpotVideoCall" title="Explainers" lead="Two-minute animations of how the main pieces work, each with a full written transcript." />
      <CardGrid items={EXPLAINERS.map((e) => ({ href: `/explainers/${e.slug}`, title: e.title, description: e.description, tag: "Animated" }))} />
    </>
  );
}
