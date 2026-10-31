import type { Metadata } from "next";
import { TOOLS } from "@/config/tools";
import { CardGrid, Cta, PageHeader } from "@/components/ui";
import { KitFaqs } from "@/components/page-kit";

export const metadata: Metadata = {
  title: "Free estate planning calculators and tools",
  description: "Estate tax, probate cost, life insurance and guardian funding calculators, plus a readiness score and planning tools.",
  alternates: { canonical: "/tools" },
};

export default function ToolsIndex() {
  return (
    <>
      <PageHeader kicker="Calculators" art="SpotCalendarReview" title="Free calculators and tools" lead="Run the numbers privately in your browser. Nothing is sent to us unless you ask for a copy." />
      <CardGrid items={TOOLS.map((t) => ({ href: `/tools/${t.slug}`, title: t.title, description: t.description, tag: "Free tool" }))} media="art" />
      <KitFaqs url="/tools" topic="cost probate" context="calculator how much estate tax fees" categories={["Cost and process"]} title="Questions people ask about the numbers" />
      <Cta from="tools" title="Want an attorney to check your numbers?" />
    </>
  );
}
