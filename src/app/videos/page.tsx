import type { Metadata } from "next";
import Link from "next/link";
import { videos } from "@/components/visuals/video";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/ui";

export const metadata: Metadata = {
  title: "Estate planning explainer videos",
  description:
    "Short, captioned videos that explain wills, trusts, probate, powers of attorney and guardianship in plain language.",
  alternates: { canonical: "/videos" },
};

export default function VideosPage() {
  return (
    <>
      <PageHero
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Videos" }]} />}
        kicker="Videos"
        path="/videos"
        art="SpotVideoCall"
        title="Estate planning, explained in a minute or two"
        lead={
          <>
            Short captioned videos on the questions people ask most. Each one has a full transcript. They are general
            education, not legal advice, and the law varies by state.
          </>
        }
      />
      {videos.length === 0 ? (
        <p>Videos are on their way.</p>
      ) : (
        <ul className="v-video-grid">
          {videos.map((v) => (
            <li key={v.slug} className="card">
              <Link href={`/videos/${v.slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.poster} alt="" width={640} height={360} loading="lazy" />
              </Link>
              <h2 style={{ fontSize: "1rem", margin: "12px 0 4px" }}>
                <Link href={`/videos/${v.slug}`}>{v.title}</Link>
              </h2>
              <p className="notice">{Math.round(v.durationSec)} seconds</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
