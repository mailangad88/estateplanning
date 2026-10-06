import Link from "next/link";
import type { Faq, Heading } from "@/lib/content";
import { articleLd, breadcrumbLd, JsonLd } from "@/lib/seo";
import { Breadcrumbs, Cta, FaqList, Prose, ReviewNote, Toc } from "@/components/ui";
import { EmailCapture, SensitiveMarker } from "@/components/capture";
import { libraryLinksFor } from "@/lib/site-links";

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
  magnet?: { interest: string; title: string; body: string; cta?: string };
}) {
  const crumbs = [
    { name: "Home", path: "/" },
    props.section,
    { name: props.title, path: props.path },
  ];
  const seen = new Set(props.related.map((r) => r.href));
  const related = [...props.related, ...libraryLinksFor(props.path).filter((l) => !seen.has(l.href))];
  return (
    <article>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: props.section.path, label: props.section.name }, { label: props.title }]} />
      <h1>{props.heading ?? props.title}</h1>
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
      <Prose html={props.html} />
      {props.after}
      <FaqList faqs={props.faqs ?? []} />
      {props.magnet ? (
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
      <JsonLd data={[articleLd({ title: props.title, description: props.description, path: props.path, updated: props.updated }), breadcrumbLd(crumbs)]} />
    </article>
  );
}
