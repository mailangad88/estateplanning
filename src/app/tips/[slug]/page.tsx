import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_DISCLAIMER } from "@/config/firm";
import { getSocialTip, SOCIAL_TIPS } from "@/config/social-tips";
import { getMagnet } from "@/lib/magnets";
import { TOOLS } from "@/config/tools";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs, FaqList, ReviewNote } from "@/components/ui";
import TipCheck from "@/components/tips/TipCheck";
import TipBookButton from "@/components/tips/TipBookButton";
import "../tips.css";

export function generateStaticParams() {
  return SOCIAL_TIPS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = getSocialTip(slug);
  if (!t) return {};
  return {
    title: t.title,
    description: t.answer.split(". ").slice(0, 2).join(". ").slice(0, 158),
    alternates: { canonical: `/tips/${t.slug}` },
    // Drafts stay out of search until the attorney approves them; social traffic still lands here.
    robots: t.reviewed ? undefined : { index: false, follow: true },
  };
}

export default async function TipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getSocialTip(slug);
  if (!t) notFound();
  const magnet = getMagnet(t.magnet);
  const tool = t.tool ? TOOLS.find((x) => x.slug === t.tool) : undefined;
  const more = SOCIAL_TIPS.filter((o) => o.slug !== t.slug && o.audience === t.audience).concat(SOCIAL_TIPS.filter((o) => o.slug !== t.slug && o.audience !== t.audience)).slice(0, 4);
  return (
    <>
      <PageHero
        compact
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/tips", label: "Quick answers" }, { label: t.label }]} />}
        kicker="Illinois quick answer"
        path={`/tips/${t.slug}`}
        title={t.title}
        lead={t.hook}
      >
        <ReviewNote reviewed={t.reviewed} updated="October 2026" />
      </PageHero>

      <article className="tip">
        <section className="tip-answer" aria-labelledby="tip-answer-h">
          <h2 id="tip-answer-h">The short answer</h2>
          <p className="tip-answer__lead">{t.answer}</p>
        </section>

        <TipCheck slug={t.slug} question={t.check.question} options={t.check.options} />

        <section aria-labelledby="tip-facts-h">
          <h2 id="tip-facts-h">What Illinois law says</h2>
          <ul className="tip-facts">
            {t.facts.map((f) => (
              <li key={f.text}>
                <span>{f.text}</span>
                <cite>{f.cite}</cite>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="tip-week-h">
          <h2 id="tip-week-h">What you can do this week</h2>
          <ol className="tip-week">
            {t.thisWeek.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        <aside className="tip-cta" aria-label="Next steps">
          <div className="tip-cta__card">
            <p className="kicker">Free download</p>
            <h2>{magnet ? magnet.title : "Free Illinois guide"}</h2>
            <p>{magnet?.description ?? "A printable guide you can keep."}</p>
            <Link className="button secondary" href={`/free/${t.magnet}`}>
              Get the free guide
            </Link>
          </div>
          {tool ? (
            <div className="tip-cta__card">
              <p className="kicker">Interactive tool</p>
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
              <Link className="button secondary" href={`/tools/${tool.slug}`}>
                Open the tool
              </Link>
            </div>
          ) : null}
          <div className="tip-cta__card tip-cta__card--book">
            <p className="kicker">Talk it through</p>
            <h2>{t.sensitive ? "When you are ready, an attorney can help" : "Get an answer for your family"}</h2>
            <p>We match you with an appropriate estate planning attorney in Illinois. Pick a time that works for you.</p>
            <TipBookButton slug={t.slug} topic={t.bookTopic} />
          </div>
        </aside>

        <FaqList faqs={t.faqs} title="People also ask" />

        <section aria-labelledby="tip-read-h">
          <h2 id="tip-read-h">Read more</h2>
          <ul className="tip-links">
            {t.related.map((r) => (
              <li key={r.href}>
                <Link href={r.href}>{r.label}</Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="tip-more-h">
          <h2 id="tip-more-h">More quick answers</h2>
          <ul className="tip-grid">
            {more.map((o) => (
              <li key={o.slug}>
                <Link href={`/tips/${o.slug}`}>{o.label}</Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="notice">{SITE_DISCLAIMER} Attorney advertising. Laws change; facts here were checked on {t.updated}.</p>
      </article>
    </>
  );
}
