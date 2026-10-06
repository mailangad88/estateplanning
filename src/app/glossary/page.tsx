import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import JsonLd from "@/components/JsonLd";
import { getGlossary as getShortDefinitions } from "@/lib/content";
import { getGlossary } from "@/lib/library";
import { absoluteUrl } from "@/config/site";
import { breadcrumbSchema, definedTermSetSchema, graph } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Estate planning glossary: terms and acronyms explained",
  description:
    "Plain-English definitions of estate planning terms and acronyms, from administrator to UTMA, with examples and links to the guides that explain them.",
  alternates: { canonical: "/glossary" },
};

interface Row {
  slug: string;
  term: string;
  definition: string;
  /** Set when the term has its own page with an example and related guides. */
  url?: string;
  seeAlso: string[];
}

/**
 * Merges the full-page glossary entries (content/glossary/*.md) with the short definitions in
 * content/glossary.json. Terms with a page link to it; the rest are defined inline with an anchor.
 */
function rows(): Row[] {
  const pages = getGlossary();
  const out: Row[] = pages.map((g) => ({ slug: g.slug, term: g.term, definition: g.short, url: g.url, seeAlso: g.seeAlso }));
  const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
  for (const t of getShortDefinitions()) {
    if (out.some((r) => r.slug === t.slug || norm(r.term) === norm(t.term))) continue;
    const term = t.acronym && t.acronym !== t.term ? `${t.term} (${t.acronym})` : t.term;
    out.push({ slug: t.slug, term, definition: t.definition, seeAlso: t.related ?? [] });
  }
  return out.sort((a, b) => a.term.localeCompare(b.term));
}

export default function GlossaryIndex() {
  const entries = rows();
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Glossary", url: "/glossary" },
  ];
  const letters = Array.from(new Set(entries.map((e) => e.term[0].toUpperCase())));
  const href = (slug: string) => {
    const r = entries.find((e) => e.slug === slug);
    return r ? (r.url ?? `#${r.slug}`) : null;
  };
  const setSchema = definedTermSetSchema(getGlossary());
  setSchema.hasDefinedTerm = entries.map((e) => ({
    "@type": "DefinedTerm",
    name: e.term,
    description: e.definition,
    url: absoluteUrl(e.url ?? `/glossary#${e.slug}`),
  }));

  return (
    <div className="content">
      <JsonLd data={graph(breadcrumbSchema(crumbs), setSchema)} />
      <Breadcrumbs items={crumbs} />
      <h1>Estate planning glossary</h1>
      <p className="lead">
        {entries.length} terms and acronyms in plain English. Terms in the library have their own page with an example and
        the guides that explain them in depth.
      </p>
      <nav aria-label="Jump to letter" className="az">
        {letters.map((l) => (
          <a key={l} href={`#letter-${l}`}>{l}</a>
        ))}
      </nav>
      {letters.map((l) => (
        <section key={l} aria-labelledby={`letter-${l}`}>
          <h2 id={`letter-${l}`}>{l}</h2>
          <dl className="glossary-list">
            {entries
              .filter((e) => e.term[0].toUpperCase() === l)
              .map((e) => {
                const also = e.seeAlso.map((s) => [s, href(s)] as const).filter(([, h]) => h);
                return (
                  <div key={e.slug} id={e.slug}>
                    <dt>{e.url ? <Link href={e.url}>{e.term}</Link> : e.term}</dt>
                    <dd>
                      {e.definition}
                      {also.length > 0 && (
                        <span className="notice">
                          {" "}See also:{" "}
                          {also.map(([s, h], i) => (
                            <span key={s}>
                              {i > 0 && ", "}
                              <a href={h!}>{entries.find((x) => x.slug === s)?.term ?? s}</a>
                            </span>
                          ))}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
          </dl>
        </section>
      ))}
      <CtaBox />
    </div>
  );
}
