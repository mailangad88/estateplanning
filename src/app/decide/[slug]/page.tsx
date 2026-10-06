import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DECISIONS, decisionPath, getDecision } from "@/config/decisions";
import { DecisionPage } from "@/components/decision/DecisionPage";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return DECISIONS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = getDecision((await params).slug);
  if (!d) return {};
  return {
    title: d.title,
    description: d.description,
    alternates: { canonical: decisionPath(d.slug) },
    openGraph: { title: d.title, description: d.description },
  };
}

export default async function Page({ params }: Props) {
  const d = getDecision((await params).slug);
  if (!d) notFound();
  return <DecisionPage guide={d} />;
}
