import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { explainerForVideo, getVideo, VideoExplainer, videos } from "@/components/visuals/video";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs, CardGrid } from "@/components/ui";

export function generateStaticParams() {
  return videos.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const v = getVideo(slug);
  if (!v) return {};
  return {
    title: v.title,
    description: v.description,
    alternates: { canonical: `/videos/${v.slug}` },
    openGraph: {
      type: "video.other",
      title: v.title,
      description: v.description,
      images: [{ url: v.poster, width: 1280, height: 720 }],
      videos: [{ url: v.src, width: 1280, height: 720, type: "video/mp4" }],
    },
  };
}

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = getVideo(slug);
  if (!v) notFound();
  const related = videos.filter((o) => o.slug !== v.slug && o.topics.some((t) => v.topics.includes(t))).slice(0, 3);
  return (
    <>
      <PageHero
        compact
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/videos", label: "Videos" }, { label: v.title }]} />}
        kicker="Video explainer"
        path={`/videos/${v.slug}`}
        title={v.title}
        lead={v.description}
      />
      <VideoExplainer slug={v.slug} pagePath={`/videos/${v.slug}`} transcript={false} />
      {explainerForVideo(v.slug) ? (
        <p>
          Want to go at your own pace? Try the{" "}
          <Link href={`/explainers/${explainerForVideo(v.slug)}`}>step-by-step interactive version</Link>.
        </p>
      ) : null}
      <h2>Transcript</h2>
      <p>{v.transcript}</p>
      {v.cta ? (
        <p>
          <Link className="button" href={v.cta.href}>
            {v.cta.label}
          </Link>
        </p>
      ) : null}
      <p className="notice">
        General education, not legal advice. Laws vary by state. Watching this video does not create an attorney-client
        relationship. Attorney advertising.
      </p>
      {related.length ? (
        <>
          <h2>Related videos</h2>
          <CardGrid items={related.map((r) => ({ href: `/videos/${r.slug}`, title: r.title }))} />
        </>
      ) : null}
    </>
  );
}
