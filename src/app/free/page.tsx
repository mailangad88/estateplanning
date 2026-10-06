import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { MAGNET_CATEGORIES, MAGNET_FORMATS, getMagnets, magnetsForState } from "@/lib/magnets";
import { DEFAULT_TOOL_STATE } from "@/config/tools";
import Library from "./Library";

export const metadata: Metadata = {
  title: "Free estate planning resource library",
  description: "Free printable checklists, worksheets, planners, templates, kits and email courses for planning ahead or settling an estate.",
  alternates: { canonical: "/free" },
};

export default function FreeLibrary() {
  const items = getMagnets().map((m) => ({
    slug: m.slug,
    title: m.title,
    promise: m.promise,
    format: m.format,
    formatLabel: MAGNET_FORMATS[m.format],
    category: m.category,
    categoryLabel: MAGNET_CATEGORIES[m.category] ?? m.category,
    pages: m.pages,
    audience: m.audience,
    lang: m.lang,
  }));
  const local = magnetsForState(DEFAULT_TOOL_STATE).filter((m) => m.lang === "en");
  return (
    <>
      <PageHeader kicker="Free library" art="SpotChecklist"
        title="Free resource library"
        lead={`${items.length} printable checklists, worksheets, planners, templates and email courses. Written in plain English and free to keep, whether or not you ever work with us.`}
      />
      <p>
        Prefer something quicker? Try a <Link href="/quizzes">2-minute quiz</Link> or a <Link href="/tools">free calculator</Link>.
      </p>
      {local.length > 0 && DEFAULT_TOOL_STATE === "IL" && (
        <section aria-labelledby="illinois">
          <h2 id="illinois">For Illinois families</h2>
          <ul className="cards">
            {local.map((m) => (
              <li key={m.slug}>
                <Link href={`/free/${m.slug}`} className="card-link">
                  <span className="tag">Free {MAGNET_FORMATS[m.format].toLowerCase()}</span>
                  <strong>{m.title}</strong>
                  <span className="card-desc">{m.promise}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Library items={items} categories={MAGNET_CATEGORIES} formats={MAGNET_FORMATS} />
    </>
  );
}
