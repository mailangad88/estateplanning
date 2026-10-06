import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVideo, VideoExplainer, videos } from "@/components/visuals/video";

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
      <p className="notice">
        <Link href="/videos">All videos</Link>
      </p>
      <h1>{v.title}</h1>
      <p className="lead">{v.description}</p>
      <VideoExplainer slug={v.slug} pagePath={`/videos/${v.slug}`} transcript={false} />
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
          <ul>
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/videos/${r.slug}`}>{r.title}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
