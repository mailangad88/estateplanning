import type { Metadata } from "next";
import Link from "next/link";
import { getHubs } from "@/lib/hubs";
import { CardGrid, PageHeader } from "@/components/ui";
import { getMagnets } from "@/lib/magnets";

export const metadata: Metadata = {
  title: "Free estate planning resources",
  description: "Every guide, article, comparison, calculator, checklist, explainer and glossary term in one place.",
  alternates: { canonical: "/resources" },
};

export default function Resources() {
  const groups = getHubs();
  return (
    <>
      <PageHeader kicker="Free resources" art="SpotSafeStorage" title="Free resources" lead="Everything we publish, free, with no sign-up required to read it. Only the printable workbooks ask for an email." />
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
      <h2>Popular free downloads</h2>
      <p>Printable workbooks and email courses. We email you a copy so you can find it later.</p>
      <CardGrid
        items={getMagnets()
          .filter((m) => ["estate-planning-checklist", "guardian-for-your-kids-worksheet", "estate-plan-document-locator", "executor-first-30-days-guide", "trust-funding-checklist", "new-parents-5-day-course"].includes(m.slug))
          .map((m) => ({ href: `/free/${m.slug}`, title: m.title, description: m.promise, tag: "Free download" }))}
      />
      <p><Link href="/free">See all {getMagnets().length} free downloads</Link></p>
    </>
  );
}
