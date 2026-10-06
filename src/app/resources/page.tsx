import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/config/tools";
import { EXPLAINERS } from "@/explainers/data";
import { getChecklists, getComparisons, getFaqs, getGlossary, getGuides, getLessons, getLifeEvents, getMistakes, getPosts } from "@/lib/content";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Free estate planning resources",
  description: "Every guide, article, comparison, calculator, checklist, explainer and glossary term in one place.",
  alternates: { canonical: "/resources" },
};

export default function Resources() {
  const groups = [
    { href: "/guides", label: "Guides", count: getGuides().length, body: "In-depth explanations of each part of a plan." },
    { href: "/blog", label: "Questions answered", count: getPosts().length, body: "Short answers to specific questions." },
    { href: "/compare", label: "Comparisons", count: getComparisons().length, body: "Side-by-side choices, factor by factor." },
    { href: "/life-events", label: "Life events", count: getLifeEvents().length, body: "What to do after a big change." },
    { href: "/tools", label: "Calculators and tools", count: TOOLS.length, body: "Run the numbers privately." },
    { href: "/checklists", label: "Checklists and worksheets", count: getChecklists().length, body: "Tick off on screen or print." },
    { href: "/explainers", label: "Animated explainers", count: EXPLAINERS.length, body: "Two-minute videos with transcripts." },
    { href: "/course", label: "7-day course", count: getLessons().length, body: "One lesson and one task a day." },
    { href: "/glossary", label: "Glossary", count: getGlossary().length, body: "Terms and acronyms in plain English." },
    { href: "/faq", label: "FAQ", count: getFaqs().length, body: "Answers to common questions." },
    { href: "/mistakes", label: "Mistakes to avoid", count: getMistakes().length, body: "What goes wrong and the fix." },
  ];
  return (
    <>
      <PageHeader title="Free resources" lead="Everything we publish, free, with no sign-up required to read it." />
      <ul className="cards">
        {groups.map((g) => (
          <li key={g.href}>
            <Link className="card-link" href={g.href}>
              <span className="tag">{g.count} items</span>
              <strong>{g.label}</strong>
              <span className="card-desc">{g.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
