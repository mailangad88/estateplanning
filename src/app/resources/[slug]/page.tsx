import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES, findGuide } from "@/content/guides";
import GuideGate from "./GuideGate";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGuide(slug);
  return guide ? { title: `${guide.title} (free download)`, description: guide.summary } : {};
}

export default async function GuideGatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();
  return (
    <>
      <h1>{guide.title}</h1>
      <p className="lead">{guide.summary}</p>
      <div className="card">
        <strong>What&apos;s inside</strong>
        <ul>
          {guide.sections.map((s) => <li key={s.heading}>{s.heading}</li>)}
        </ul>
        <p className="notice">About {guide.pages} printed pages. Free.</p>
      </div>
      <GuideGate slug={guide.slug} />
    </>
  );
}
