import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { MAGNET_CATEGORIES, MAGNET_FORMATS, getMagnets } from "@/lib/magnets";
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
  return (
    <>
      <PageHeader kicker="Free library" art="SpotChecklist"
        title="Free resource library"
        lead={`${items.length} printable checklists, worksheets, planners, templates and email courses. Written in plain English and free to keep, whether or not you ever work with us.`}
      />
      <p>
        Prefer something quicker? Try a <Link href="/quizzes">2-minute quiz</Link> or a <Link href="/tools">free calculator</Link>.
      </p>
      <Library items={items} categories={MAGNET_CATEGORIES} formats={MAGNET_FORMATS} />
    </>
  );
}
