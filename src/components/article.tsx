import Link from "next/link";
import type { Faq, Heading } from "@/lib/content";
import { articleLd, breadcrumbLd, JsonLd } from "@/lib/seo";
import { Breadcrumbs, Cta, FaqList, Prose, ReviewNote, Toc } from "@/components/ui";
import { EmailCapture } from "@/components/capture";
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
  magnet?: { interest: string; title: string; body: string };
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
  return (
    <article>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: props.section.path, label: props.section.name }, { label: props.title }]} />
      <h1>{props.title}</h1>
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
      <Toc headings={props.headings} />
      {quiz && (
        <p className="quiz-teaser no-print">
          <span className="tag">2-minute quiz</span> <Link href={`/quizzes/${quiz.slug}`}>{quiz.title}</Link>
        </p>
      )}
      <Prose html={props.html} />
      {props.after}
      <FaqList faqs={props.faqs ?? []} />
      {lead ? (
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
        <EmailCapture kind="magnet" interest={props.magnet.interest} title={props.magnet.title} body={props.magnet.body} />
      ) : (
        <Cta />
      )}
      {props.related.length > 0 && (
        <section>
          <h2>Keep reading</h2>
          <ul className="cards">
            {props.related.map((r) => (
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
      <JsonLd data={[articleLd({ title: props.title, description: props.description, path: props.path, updated: props.updated }), breadcrumbLd(crumbs)]} />
    </article>
  );
}
