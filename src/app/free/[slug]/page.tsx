import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MagnetOptIn from "@/components/MagnetOptIn";
import { Breadcrumbs, CardGrid, ReviewNote } from "@/components/ui";
import { PageHero } from "@/components/page-hero";
import { MAGNET_CATEGORIES, MAGNET_FORMATS, getMagnet, getMagnets, translationsOf } from "@/lib/magnets";
import { resolveSlug } from "@/lib/links";
import { breadcrumbLd, JsonLd } from "@/lib/seo";
import { ResourceCover } from "@/components/visuals/covers/ResourceCover";
import { coverPropsFromMagnet } from "@/components/visuals/covers/fromMeta";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getMagnets().map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = getMagnet((await params).slug);
  if (!m) return {};
  const title = `${m.title} (free ${MAGNET_FORMATS[m.format].toLowerCase()})`;
  return { title, description: m.description, alternates: { canonical: `/free/${m.slug}` }, openGraph: { title, description: m.description } };
}

export default async function MagnetLanding({ params }: Props) {
  const m = getMagnet((await params).slug);
  if (!m) notFound();
  const formatLabel = MAGNET_FORMATS[m.format];
  const related = m.related
    .map((r) => resolveSlug(r.split("/").pop() ?? r))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, 4);
  const more = getMagnets()
    .filter((x) => x.slug !== m.slug && x.category === m.category && x.lang === m.lang)
    .slice(0, 3);
  const inside = m.format === "email-course" ? m.lessons.map((l) => `Day ${l.day}: ${l.subject}`) : m.headings.map((h) => h.text).filter((t) => !/^(When to talk to an attorney|Next step|Sources|Cuándo hablar con un abogado|Siguiente paso|Fuentes)$/i.test(t));
  const cover = coverPropsFromMagnet(m);
  const es = m.lang === "es";
  const alternates = translationsOf(m);
  const summary = { lang: m.lang, slug: m.slug, title: m.title, format: m.format, formatLabel, tag: m.tag, sequence: m.sequence };

  return (
    <article className="magnet-landing" lang={m.lang}>
      <PageHero
        compact
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/free", label: "Free resources" }, { label: m.title }]} />}
        kicker={`Free ${formatLabel.toLowerCase()} · ${MAGNET_CATEGORIES[m.category] ?? m.category}`}
        path={`/free/${m.slug}`}
        title={m.title}
        lead={m.promise}
      />
      {alternates.map((a) => (
        <p key={a.slug} className="meta">
          <Link href={`/free/${a.slug}`} hrefLang={a.lang} lang={a.lang}>{a.lang === "es" ? "También disponible en español" : "Also available in English"}</Link>
        </p>
      ))}
      <div className="magnet-landing__grid">
        <div>
          <div className="magnet-cover" aria-hidden="true"><ResourceCover {...cover} bare /></div>
          {m.benefits.length > 0 && (
            <ul className="benefits">
              {m.benefits.map((b) => <li key={b}>{b}</li>)}
            </ul>
          )}
          <p className="meta">
            {m.audience && <>For: {m.audience} · </>}
            {m.format === "email-course" ? "5 short emails" : `About ${m.pages} printed pages`} · Free
          </p>
          <div className="card">
            <strong>{m.format === "email-course" ? "The lessons" : es ? "Qué incluye" : "What's inside"}</strong>
            <ol className="inside">{inside.map((t) => <li key={t}>{t}</li>)}</ol>
          </div>
        </div>
        <MagnetOptIn magnet={summary} />
      </div>
      <ReviewNote reviewed={m.reviewed} updated={m.updated} />
      {related.length > 0 && (
        <section>
          <h2>Read more on this topic</h2>
          <CardGrid items={related.map((r) => ({ href: r.href, title: r.title, tag: r.kind }))} />
        </section>
      )}
      {more.length > 0 && (
        <section>
          <h2>More free resources</h2>
          <CardGrid items={more.map((x) => ({ href: `/free/${x.slug}`, title: x.title, description: x.promise, tag: MAGNET_FORMATS[x.format] }))} />
        </section>
      )}
      <p className="notice">General information, not legal advice. Laws differ by state. Attorney advertising.</p>
      <JsonLd data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Free resources", path: "/free" }, { name: m.title, path: `/free/${m.slug}` }])]} />
    </article>
  );
}
