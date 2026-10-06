import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EXPLAINERS } from "@/explainers/data";
import ExplainerPlayer from "@/explainers/Player";
import { Breadcrumbs, CardGrid, Cta } from "@/components/ui";
import { PageHero } from "@/components/page-hero";
import { JsonLd, breadcrumbLd, howToLd } from "@/lib/seo";
import { VideoExplainer } from "@/components/visuals/video/VideoExplainer";
import { EXPLAINER_VIDEO } from "@/components/visuals/video/explainerMap";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return EXPLAINERS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const e = EXPLAINERS.find((x) => x.slug === slug);
  if (!e) return {};
  return { title: e.title, description: e.description, alternates: { canonical: `/explainers/${e.slug}` } };
}

export default async function ExplainerPage({ params }: Props) {
  const { slug } = await params;
  const e = EXPLAINERS.find((x) => x.slug === slug);
  if (!e) notFound();
  const video = EXPLAINER_VIDEO[e.slug];
  return (
    <article>
      <PageHero
        compact
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/explainers", label: "Explainers" }, { label: e.title }]} />}
        kicker="Step-by-step explainer"
        path={`/explainers/${e.slug}`}
        title={e.title}
      />
      <div className="answer"><strong>In short</strong>{e.intro} {e.outro}</div>
      <ExplainerPlayer slug={e.slug} />
      {video ? (
        <>
          <h2>Prefer to watch? The captioned video</h2>
          <VideoExplainer slug={video} pagePath={`/explainers/${e.slug}`} transcript={false} />
        </>
      ) : null}
      <h2>Transcript</h2>
      <p>{e.intro}</p>
      <ol>
        {e.steps.map((s) => (
          <li key={s.title}><strong>{s.title}.</strong> {s.body}</li>
        ))}
      </ol>
      <p>{e.outro}</p>
      <h2>Learn more</h2>
      <CardGrid items={e.related.map((r) => ({ href: r, title: r.replace(/^\/[^/]+\//, "").replace(/-/g, " ") }))} />
      <Cta />
      <JsonLd
        data={[
          howToLd({ name: e.title, description: e.description, steps: e.steps.map((s) => ({ name: s.title, text: s.body })) }),
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Explainers", path: "/explainers" }, { name: e.title, path: `/explainers/${e.slug}` }]),
        ]}
      />
    </article>
  );
}
