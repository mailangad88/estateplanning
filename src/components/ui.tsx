import Link from "next/link";
import { firm } from "@/config/firm";
import type { Faq, Heading } from "@/lib/content";

export function ReviewNote({ reviewed, updated }: { reviewed: boolean; updated: string }) {
  return (
    <p className="meta">
      {reviewed ? `Reviewed by ${firm.attorneyName}, ${firm.attorneyTitle.toLowerCase()}` : "Draft pending attorney review"}
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
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
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

export function CardGrid({ items }: { items: { href: string; title: string; description?: string; tag?: string }[] }) {
  return (
    <ul className="cards">
      {items.map((i) => (
        <li key={i.href}>
          <Link href={i.href} className="card-link">
            {i.tag && <span className="tag">{i.tag}</span>}
            <strong>{i.title}</strong>
            {i.description && <span className="card-desc">{i.description}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Cta({ title = "Talk it through with an attorney", body }: { title?: string; body?: string }) {
  return (
    <aside className="cta">
      <strong>{title}</strong>
      <p>{body ?? "Answer a few questions and we will set up a consult. You get a flat-fee quote before anything is signed."}</p>
      <Link className="button" href="/plan-finder">Start the plan finder</Link>
    </aside>
  );
}

export function PageHeader({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <header className="page-header">
      {children}
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
    </header>
  );
}
