import Link from "next/link";
import BookCta from "@/components/BookCta";
import { firm } from "@/config/firm";
import type { Faq, Heading } from "@/lib/content";
import { decorateSections } from "@/lib/prose-sections";
import { PageHero } from "@/components/page-hero";
import { VisualCardGrid, type CardItem, type CardMedia } from "@/components/visual-card";

export function ReviewNote({ reviewed, updated }: { reviewed: boolean; updated: string }) {
  return (
    <p className="meta">
      {reviewed ? "Reviewed by " : "Draft pending review by "}
      <Link href="/about-the-attorney" rel="author">{firm.attorneyName}</Link>
      {reviewed ? `, ${firm.attorneyTitle.toLowerCase()}` : ""}
      {updated ? ` · Updated ${updated}` : ""} · <Link href="/editorial-policy">How we review</Link>
    </p>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      {items.map((c, i) => (
        <span key={c.label}>
          {i > 0 && " / "}
          {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
        </span>
      ))}
    </nav>
  );
}

export function Toc({ headings }: { headings: Heading[] }) {
  if (headings.length < 3) return null;
  return (
    <details className="toc" open>
      <summary>On this page</summary>
      <ol>
        {headings.map((h) => (
          <li key={h.id}><a href={`#${h.id}`}>{h.text}</a></li>
        ))}
      </ol>
    </details>
  );
}

export function Prose({ html }: { html: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: decorateSections(html) }} />;
}

export function FaqList({ faqs, title = "Common questions" }: { faqs: Faq[]; title?: string }) {
  if (!faqs.length) return null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <section>
      <h2>{title}</h2>
      {faqs.map((f) => (
        <details className="faq" key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}

export function CardGrid({ items, media }: { items: CardItem[]; media?: CardMedia }) {
  return <VisualCardGrid items={items} media={media} />;
}

/**
 * End-of-page call to action. Booking leads (see BookCta); the plan finder stays as the second option.
 * Without a title or body it shows the audience offer for the page (config/booking-offers.ts).
 */
export function Cta({ title, body, from, topic }: { title?: string; body?: string; from?: string; topic?: string }) {
  return <BookCta title={title} body={body} from={from} topic={topic} />;
}

export function PageHeader({ title, lead, children, kicker, art, path }: { title: string; lead?: string; children?: React.ReactNode; kicker?: string; art?: string; path?: string }) {
  return (
    <PageHero title={title} lead={lead} kicker={kicker} art={art} path={path}>
      {children}
    </PageHero>
  );
}
