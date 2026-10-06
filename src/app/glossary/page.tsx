import type { Metadata } from "next";
import { getGlossary } from "@/lib/content";
import { Cta, PageHeader } from "@/components/ui";
import { JsonLd, abs } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Estate planning glossary: terms and acronyms explained",
  description: "Plain-English definitions of estate planning terms and acronyms, from administrator to UTMA.",
  alternates: { canonical: "/glossary" },
};

export default function GlossaryPage() {
  const terms = getGlossary();
  const letters = [...new Set(terms.map((t) => t.term[0].toUpperCase()))];
  return (
    <>
      <PageHeader title="Estate planning glossary" lead={`${terms.length} terms and acronyms, explained in plain English.`} />
      <nav className="az" aria-label="Jump to letter">
        {letters.map((l) => <a key={l} href={`#letter-${l}`}>{l}</a>)}
      </nav>
      <dl className="glossary">
        {letters.map((l) => (
          <div key={l}>
            <h2 id={`letter-${l}`}>{l}</h2>
            {terms.filter((t) => t.term[0].toUpperCase() === l).map((t) => (
              <div key={t.slug}>
                <dt id={t.slug}>{t.term}{t.acronym && t.acronym !== t.term ? ` (${t.acronym})` : ""}</dt>
                <dd>
                  {t.definition}
                  {t.related?.length > 0 && (
                    <span className="notice"> See also: {t.related.map((r, i) => <span key={r}>{i > 0 && ", "}<a href={`#${r}`}>{terms.find((x) => x.slug === r)?.term ?? r}</a></span>)}</span>
                  )}
                </dd>
              </div>
            ))}
          </div>
        ))}
      </dl>
      <Cta />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          name: "Estate planning glossary",
          url: abs("/glossary"),
          hasDefinedTerm: terms.map((t) => ({ "@type": "DefinedTerm", name: t.term, description: t.definition, url: abs(`/glossary#${t.slug}`) })),
        }}
      />
    </>
  );
}
