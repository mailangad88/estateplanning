import type { Metadata } from "next";
import { TOOLS } from "@/config/tools";
import { CardGrid, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Free estate planning calculators and tools",
  description: "Estate tax, probate cost, life insurance and guardian funding calculators, plus a readiness score and planning tools.",
  alternates: { canonical: "/tools" },
};

export default function ToolsIndex() {
  return (
    <>
      <PageHeader kicker="Calculators" art="SpotCalendarReview" title="Free calculators and tools" lead="Run the numbers privately in your browser. Nothing is sent to us unless you ask for a copy." />
      <CardGrid items={TOOLS.map((t) => ({ href: `/tools/${t.slug}`, title: t.title, description: t.description, tag: "Free tool" }))} />
    </>
  );
}
