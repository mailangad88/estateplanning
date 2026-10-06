import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import SiteSearch from "@/components/SiteSearch";

export const metadata: Metadata = {
  title: "Search",
  description: "Search every guide, article, tool, free resource, state guide and glossary term on the site.",
  alternates: { canonical: "/search" },
  // Result pages are thin by nature; keep them out of the index but let crawlers follow the links.
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <>
      <PageHeader title="Search" lead="Find a guide, tool, free resource, state guide or glossary term." />
      <Suspense>
        <SiteSearch />
      </Suspense>
    </>
  );
}
