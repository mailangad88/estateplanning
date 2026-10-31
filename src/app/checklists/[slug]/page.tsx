import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bySlug, getChecklists } from "@/lib/content";
import { Breadcrumbs, CardGrid, ReviewNote } from "@/components/ui";
import { PageHero } from "@/components/page-hero";
import { EmailCapture } from "@/components/capture";
import { breadcrumbLd, howToLd, JsonLd } from "@/lib/seo";
import ChecklistView from "./Checklist";
import CtaBox from "@/components/CtaBox";
import { KitAnswer, KitFaqs } from "@/components/page-kit";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getChecklists().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = bySlug(getChecklists(), (await params).slug);
  if (!c) return {};
  return { title: c.title, description: c.description, alternates: { canonical: `/checklists/${c.slug}` } };
}

export default async function ChecklistPage({ params }: Props) {
  const c = bySlug(getChecklists(), (await params).slug);
  if (!c) notFound();
  return (
    <article>
      <PageHero
        compact
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/checklists", label: "Checklists" }, { label: c.title }]} />}
        kicker="Checklist"
        path={`/checklists/${c.slug}`}
        title={c.title}
      >
        <ReviewNote reviewed={c.reviewed} updated={c.updated} />
      </PageHero>
      <KitAnswer answer={c.description} label="What this checklist covers" />
      <p className="lead">{c.intro}</p>
      <ChecklistView slug={c.slug} sections={c.sections} />
      <EmailCapture kind="magnet" interest={`checklist:${c.slug}`} title="Email me a printable copy" body="We'll send this checklist and a reminder to review it once a year." cta="Send the checklist" />
      <KitFaqs url={`/checklists/${c.slug}`} topic={c.title.replace(/checklist/i, "")} context={`${c.description} ${c.sections.map((s) => s.heading).join(" ")}`} categories={["Getting started"]} />
      <CtaBox from={`checklist-${c.slug}`} />
      <h2>More checklists</h2>
      <CardGrid items={getChecklists().filter((x) => x.slug !== c.slug).slice(0, 4).map((x) => ({ href: `/checklists/${x.slug}`, title: x.title, description: x.description, tag: "Printable" }))} />
      <JsonLd
        data={[
          howToLd({ name: c.title, description: c.description, steps: c.sections.flatMap((s) => s.items.map((i) => ({ name: s.heading, text: i }))) }),
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Checklists", path: "/checklists" }, { name: c.title, path: `/checklists/${c.slug}` }]),
        ]}
      />
    </article>
  );
}
