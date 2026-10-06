import Link from "next/link";
import type { Faq, Heading } from "@/lib/content";
import { articleLd, JsonLd } from "@/lib/seo";
import { Breadcrumbs, Cta, FaqList, Prose, ReviewNote, Toc } from "@/components/ui";
import { EmailCapture, SensitiveMarker } from "@/components/capture";
import { libraryLinksFor } from "@/lib/site-links";
import { PageMedia } from "@/components/visuals/PageMedia";
import MagnetOptIn from "@/components/MagnetOptIn";
import { MAGNET_FORMATS, magnetsFor, pillarOf } from "@/lib/magnets";
import { quizzesFor } from "@/lib/quizzes";

export interface RelatedLink {
  href: string;
  title: string;
  kind: string;
}

export function ArticlePage(props: {
  section: { name: string; path: string };
  path: string;
  title: string;
  /** H1 when it differs from the shorter `title` used in breadcrumbs. */
  heading?: string;
  /** Skip analytics events and the exit-intent offer on this page. */
  sensitive?: boolean;
  description: string;
  answer?: string;
  updated: string;
  reviewed: boolean;
  html: string;
  headings: Heading[];
  faqs?: Faq[];
  related: RelatedLink[];
  before?: React.ReactNode;
  after?: React.ReactNode;
  /** Replaces the breadcrumbs and H1 with a designed hero (landing pages). The hero must render the H1. */
  hero?: React.ReactNode;
  magnet?: { interest: string; title: string; body: string; cta?: string };
}) {
  // Free resources written for this page (or this post's pillar guide) replace the generic email offer.
  const offers = magnetsFor(props.path);
  const lead = offers[0];
  const quiz = quizzesFor(props.path, pillarOf(props.path))[0];
  const crumbs = [
    { name: "Home", path: "/" },
    props.section,
    { name: props.title, path: props.path },
  ];
  const seen = new Set(props.related.map((r) => r.href));
  const related = [...props.related, ...libraryLinksFor(props.path).filter((l) => !seen.has(l.href))];
  return (
    <article>
      {props.hero ?? (
        <>
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: props.section.path, label: props.section.name }, { label: props.title }]} />
          <h1>{props.heading ?? props.title}</h1>
        </>
      )}
      <ReviewNote reviewed={props.reviewed} updated={props.updated} />
      {props.answer ? (
        <div className="answer">
          <strong>Short answer</strong>
          {props.answer}
        </div>
      ) : (
        <p className="lead">{props.description}</p>
      )}
      {props.before}
      <PageMedia path={props.path} />
      <Toc headings={props.headings} />
      {quiz && (
        <p className="quiz-teaser no-print">
          <span className="tag">2-minute quiz</span> <Link href={`/quizzes/${quiz.slug}`}>{quiz.title}</Link>
        </p>
      )}
      <Prose html={props.html} />
      {props.after}
      <FaqList faqs={props.faqs ?? []} />
      {lead && !props.sensitive ? (
        <section className="magnet-callout">
          <MagnetOptIn
            magnet={{ slug: lead.slug, title: lead.title, format: lead.format, formatLabel: MAGNET_FORMATS[lead.format], tag: lead.tag, sequence: lead.sequence }}
            heading={`Free ${MAGNET_FORMATS[lead.format].toLowerCase()}: ${lead.title}`}
          />
          {offers.length > 1 && (
            <>
              <h2>More free resources on this topic</h2>
              <ul className="cards">
                {offers.slice(1).map((o) => (
                  <li key={o.slug}>
                    <Link href={`/free/${o.slug}`} className="card-link">
                      <span className="tag">Free {MAGNET_FORMATS[o.format].toLowerCase()}</span>
                      <strong>{o.title}</strong>
                      <span className="card-desc">{o.promise}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : props.magnet ? (
        <EmailCapture kind="magnet" interest={props.magnet.interest} title={props.magnet.title} body={props.magnet.body} cta={props.magnet.cta} sensitive={props.sensitive} />
      ) : (
        <Cta />
      )}
      {related.length > 0 && (
        <section>
          <h2>Keep reading</h2>
          <ul className="cards">
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="card-link">
                  <span className="tag">{r.kind}</span>
                  <strong>{r.title}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="notice">
        This page is general information, not legal advice. Laws differ by state. Talk to an attorney licensed in your
        state about your situation.
      </p>
      {props.sensitive && <SensitiveMarker />}
      <JsonLd
        data={articleLd({
          title: props.title,
          description: props.description,
          path: props.path,
          updated: props.updated,
          reviewed: props.reviewed,
          type: props.path.startsWith("/blog/") ? "BlogPosting" : "Article",
          crumbs,
        })}
      />
    </article>
  );
}
