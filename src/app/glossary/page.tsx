import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { getGlossary } from "@/lib/content";
import { breadcrumbSchema, definedTermSchema, definedTermSetSchema, graph } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Estate planning glossary: plain-English definitions",
  description:
    "Plain-English definitions of the estate planning terms you will see in wills, trusts, probate papers and powers of attorney, each with an example.",
  alternates: { canonical: "/glossary" },
};

export default function GlossaryIndex() {
  const entries = getGlossary();
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Glossary", url: "/glossary" },
  ];
  const letters = Array.from(new Set(entries.map((e) => e.term[0].toUpperCase())));
  return (
    <div className="content">
      <JsonLd data={graph(breadcrumbSchema(crumbs), definedTermSetSchema(entries), ...entries.map(definedTermSchema))} />
      <Breadcrumbs items={crumbs} />
      <h1>Estate planning glossary</h1>
      <p className="lead">
        Short, plain definitions of the words lawyers use, each with an example and a link to the guide that explains it
        in depth.
      </p>
      <nav aria-label="Jump to letter" className="chips letters">
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
              .map((e) => (
                <div key={e.slug}>
                  <dt><Link href={e.url}>{e.term}</Link></dt>
                  <dd>{e.short}</dd>
                </div>
              ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
