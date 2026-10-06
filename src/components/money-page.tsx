import Link from "next/link";
import { Check, Info, X } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ICON_MAP } from "@/components/visual-card";
import { topicFor } from "@/lib/visual-topic";
import { CallbackForm, EmailCapture } from "@/components/capture";
import { Breadcrumbs, CardGrid, Cta, ReviewNote } from "@/components/ui";
import { firm } from "@/config/firm";
import type { MoneyPageData, Block } from "@/content/money-pages";
import { serviceBoardFor } from "@/config/life-game";
import { LifeGame } from "@/components/life-game";
import { abs, breadcrumbLd, howToLd, JsonLd, SITE_URL } from "@/lib/seo";

const TOKEN = /\[([^\]]+)\]\((\/[^)\s]*)\)|\*\*([^*]+)\*\*|(\[(?:Attorney|Flat fee|Firm|Office|Bar number)[^\]]*\])/g;

/** Renders the small inline syntax used in page data: [text](/path), **bold**, and [Attorney: ...] placeholders. */
export function Rich({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[1] !== undefined) out.push(<Link key={i++} href={m[2]}>{m[1]}</Link>);
    else if (m[3] !== undefined) out.push(<strong key={i++}>{m[3]}</strong>);
    else out.push(<mark key={i++} className="todo">{m[4]}</mark>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** Plain text version of inline syntax, for structured data. */
export function plain(text: string): string {
  return text.replace(/\[([^\]]+)\]\(\/[^)\s]*\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
}

/** FAQ block that renders inline links and emits FAQPage JSON-LD with the links stripped. */
export function RichFaqList({ faqs, title = "Common questions" }: { faqs: { q: string; a: string }[]; title?: string }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })),
  };
  return (
    <section>
      <h2>{title}</h2>
      {faqs.map((f) => (
        <details className="faq" key={f.q}>
          <summary>{f.q}</summary>
          <p><Rich text={f.a} /></p>
        </details>
      ))}
      <JsonLd data={ld} />
    </section>
  );
}

function BlockView({ b, negative }: { b: Block; negative?: boolean }) {
  if ("p" in b) return <p><Rich text={b.p} /></p>;
  if ("ul" in b) {
    const Mark = negative ? X : Check;
    return (
      <ul className={`check-grid${negative ? " is-negative" : ""}`}>
        {b.ul.map((x) => <li key={x}><span className="check-grid__mark" aria-hidden="true"><Mark size={16} strokeWidth={2.5} /></span><span><Rich text={x} /></span></li>)}
      </ul>
    );
  }
  if ("ol" in b) return <ol className="step-list">{b.ol.map((x) => <li key={x}><Rich text={x} /></li>)}</ol>;
  if ("note" in b) return <aside className="callout callout--icon"><Info size={20} aria-hidden="true" /><span><Rich text={b.note} /></span></aside>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{b.table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {b.table.rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (i === 0 ? <th key={i} scope="row"><Rich text={c} /></th> : <td key={i}><Rich text={c} /></td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionView({ s }: { s: MoneyPageData["sections"][number] }) {
  const t = topicFor(s.h);
  const Icon = ICON_MAP[t.icon] ?? ICON_MAP.FileText;
  const negative = /\b(not|cannot|can't|don't|doesn't|without|mistakes?)\b/i.test(s.h);
  return (
    <section id={s.id} className="mp-section">
      <h2 className="h-icon">
        <span className={`icon-badge icon-badge--${t.tone}`} aria-hidden="true"><Icon size={22} /></span>
        {s.h}
      </h2>
      {s.blocks.map((b, i) => <BlockView key={i} b={b} negative={negative} />)}
    </section>
  );
}

export function MoneyPage({ page }: { page: MoneyPageData }) {
  const digits = firm.phone.replace(/\D/g, "");
  const callFirst = page.cta === "call";
  const crumbs = [{ name: "Home", path: "/" }, { name: page.crumb, path: page.path }];
  const ld: object[] = [
    breadcrumbLd(crumbs),
    page.schema === "contact"
      ? { "@context": "https://schema.org", "@type": "ContactPage", name: page.h1, url: abs(page.path) }
      : page.schema === "profile"
        ? {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            name: page.h1,
            url: abs(page.path),
            mainEntity: { "@type": "Person", name: firm.attorneyName, jobTitle: "Attorney", worksFor: { "@type": "LegalService", name: firm.firmLegalName, url: SITE_URL } },
          }
        : {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: page.h1,
            description: page.description,
            url: abs(page.path),
            ...(page.serviceType ? { about: { "@type": "Service", serviceType: page.serviceType, provider: { "@type": "LegalService", name: firm.firmLegalName, url: SITE_URL } } } : {}),
          },
  ];
  const board = serviceBoardFor(page.path);
  if (page.steps) ld.push(howToLd({ name: page.h1, description: page.description, steps: page.steps }));

  const primary = callFirst ? (
    <a className="button" href={`tel:${digits}`}>Call {firm.phone}</a>
  ) : (
    <Link className="button" href="/plan-finder">Start the plan finder</Link>
  );
  const secondary = callFirst ? (
    <Link className="button secondary" href="/plan-finder">Book a consult</Link>
  ) : (
    <Link className="button secondary" href="/pricing">See our flat fees</Link>
  );

  return (
    <article>
      <PageHero
        path={page.path}
        kicker={page.crumb}
        title={page.h1}
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { label: page.crumb }]} />}
      >
        <p className="cta-row no-print">{primary}{secondary}</p>
      </PageHero>
      <ReviewNote reviewed={false} updated="October 2026" />
      <div className="answer">
        <strong>In short</strong>
        <Rich text={page.answer} />
      </div>
      {board && (
        <section className="lgame-section" aria-labelledby="what-if-game">
          <p className="kicker">The what-if game</p>
          <h2 id="what-if-game">What happens if this waits?</h2>
          <p>Move along the board. At each what-if, plan for it or put it off, and see what usually happens.</p>
          <LifeGame squares={board} bookHref="/plan-finder" phone={firm.phone} senior={callFirst} id="game-service" />
        </section>
      )}
      {page.jump && (
        <p className="no-print">{page.jump.map((j, i) => <span key={j.id}>{i > 0 && " · "}<a href={`#${j.id}`}>{j.label}</a></span>)}</p>
      )}
      {page.urgent && (
        <aside className="callout">
          <strong>{page.urgent.title}</strong> <Rich text={page.urgent.body} /> <a href={`tel:${digits}`}>Call {firm.phone}</a>
        </aside>
      )}
      {page.sections.map((s) => (
        <SectionView key={s.h} s={s} />
      ))}
      {page.callbackForm && (
        <section id="call-back">
          <h2>Talk to us about this</h2>
          <p>Call {firm.phone}, or leave your number and the intake team will call you back. Our stated response time: {firm.responseTime}. They are not lawyers and do not give legal advice.</p>
          <CallbackForm interest={page.callbackForm} />
        </section>
      )}
      <RichFaqList faqs={page.faqs} />
      {page.emailCapture && (
        <EmailCapture kind="magnet" interest={page.emailCapture.interest} title={page.emailCapture.title} body={page.emailCapture.body} />
      )}
      <Cta
        title={page.ctaTitle ?? "Not sure where to start?"}
        body={page.ctaBody ?? "Take the two-minute questionnaire, or call and ask us. If you may not need an attorney, we will say so. You get a flat-fee quote before anything is signed."}
      />
      <section>
        <h2>Keep reading</h2>
        <CardGrid items={page.related.map((r) => ({ href: r.href, title: r.title, tag: r.kind }))} />
      </section>
      <p className="notice">
        Attorney advertising. This page is general information, not legal advice. Reading it or contacting us does not create an
        attorney-client relationship; that begins only when we sign a written engagement agreement with you. Laws differ by
        state and change over time, so check how they apply to your situation before you act.
      </p>
      <JsonLd data={ld} />
    </article>
  );
}
