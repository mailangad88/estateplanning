import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MagnetOptIn from "@/components/MagnetOptIn";
import { Breadcrumbs, ReviewNote } from "@/components/ui";
import { MAGNET_CATEGORIES, MAGNET_FORMATS, getMagnet, getMagnets } from "@/lib/magnets";
import { resolveSlug } from "@/lib/links";
import { breadcrumbLd, JsonLd } from "@/lib/seo";
import { ResourceCover, type CoverPalette } from "@/components/visuals/covers/ResourceCover";
import { getMagnet as getCover } from "@/components/visuals/covers/magnets";

const CATEGORY_ART: Record<string, { icon: string; palette: CoverPalette }> = {
  basics: { icon: "list", palette: "accent" },
  wills: { icon: "will", palette: "accent" },
  trusts: { icon: "trust", palette: "sage" },
  property: { icon: "house", palette: "gold" },
  incapacity: { icon: "health-directive", palette: "sage" },
  family: { icon: "family", palette: "clay" },
  tax: { icon: "dollar", palette: "gold" },
  "elder-care": { icon: "hand-heart", palette: "sage" },
  administration: { icon: "sprout", palette: "sage" },
  business: { icon: "briefcase", palette: "gold" },
};

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
    .filter((x) => x.slug !== m.slug && x.category === m.category)
    .slice(0, 3);
  const inside = m.format === "email-course" ? m.lessons.map((l) => `Day ${l.day}: ${l.subject}`) : m.headings.map((h) => h.text).filter((t) => !/^(When to talk to an attorney|Next step|Sources)$/i.test(t));
  const art = CATEGORY_ART[m.category] ?? CATEGORY_ART.basics;
  const cover = getCover(m.slug) ?? {
    title: m.title,
    subtitle: m.audience,
    kicker: `Free ${formatLabel.toLowerCase()}`,
    icon: m.format === "email-course" ? "envelope" : art.icon,
    palette: art.palette,
    calm: m.sequence === "G",
  };
  const summary = { slug: m.slug, title: m.title, format: m.format, formatLabel, tag: m.tag, sequence: m.sequence };

  return (
    <article className="magnet-landing">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/free", label: "Free resources" }, { label: m.title }]} />
      <p className="tag">Free {formatLabel.toLowerCase()} · {MAGNET_CATEGORIES[m.category] ?? m.category}</p>
      <h1>{m.title}</h1>
      <p className="lead">{m.promise}</p>
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
            <strong>{m.format === "email-course" ? "The lessons" : "What's inside"}</strong>
            <ol className="inside">{inside.map((t) => <li key={t}>{t}</li>)}</ol>
          </div>
        </div>
        <MagnetOptIn magnet={summary} />
      </div>
      <ReviewNote reviewed={m.reviewed} updated={m.updated} />
      {related.length > 0 && (
        <section>
          <h2>Read more on this topic</h2>
          <ul className="cards">
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="card-link"><span className="tag">{r.kind}</span><strong>{r.title}</strong></Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {more.length > 0 && (
        <section>
          <h2>More free resources</h2>
          <ul className="cards">
            {more.map((x) => (
              <li key={x.slug}>
                <Link href={`/free/${x.slug}`} className="card-link">
                  <span className="tag">{MAGNET_FORMATS[x.format]}</span><strong>{x.title}</strong><span className="card-desc">{x.promise}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="notice">General information, not legal advice. Laws differ by state. Attorney advertising.</p>
      <JsonLd data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Free resources", path: "/free" }, { name: m.title, path: `/free/${m.slug}` }])]} />
    </article>
  );
}
