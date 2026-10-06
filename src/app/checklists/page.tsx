import type { Metadata } from "next";
import { getChecklists } from "@/lib/content";
import { CardGrid, PageHeader } from "@/components/ui";
import { EmailCapture } from "@/components/capture";

export const metadata: Metadata = {
  title: "Free estate planning checklists and worksheets",
  description: "Printable checklists for gathering documents, choosing guardians and executors, funding a trust and handling the first 30 days after a death.",
  alternates: { canonical: "/checklists" },
};

export default function ChecklistsIndex() {
  return (
    <>
      <PageHeader title="Checklists and worksheets" lead="Tick items off on screen or print them. Your progress stays on this device; nothing is sent to us unless you ask." />
      <CardGrid items={getChecklists().map((c) => ({ href: `/checklists/${c.slug}`, title: c.title, description: c.description, tag: "Printable" }))} />
      <EmailCapture kind="magnet" interest="starter-kit" title="Get all of them in one email" body="Every checklist on this page as a printable bundle." cta="Email me the bundle" />
    </>
  );
}
