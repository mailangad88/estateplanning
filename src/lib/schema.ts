import { firm } from "@/config/firm";
import { absoluteUrl, site } from "@/config/site";
import type { Article, City, Faq, GlossaryEntry, StateGuide } from "@/lib/library";

/**
 * schema.org JSON-LD builders. Entities reference each other by @id so search engines and
 * AI crawlers can connect every page to the same firm, website and attorney.
 */

type Json = Record<string, unknown>;

const ORG_ID = `${site.url}/#firm`;
const SITE_ID = `${site.url}/#website`;
const ATTORNEY_ID = `${site.url}/#attorney`;

export function organizationSchema(): Json {
  return {
    "@type": ["LegalService", "Attorney"],
    "@id": ORG_ID,
    name: firm.brandName,
    legalName: firm.firmLegalName,
    url: site.url,
    telephone: firm.phone,
    address: firm.officeAddress, // PLACEHOLDER: replace with a PostalAddress once confirmed
    areaServed: servedArea(),
    knowsAbout: [
      "Estate planning", "Wills", "Revocable living trusts", "Probate", "Trust administration",
      "Powers of attorney", "Advance healthcare directives", "Guardianship", "Special needs planning",
      "Business succession planning", "Medicaid planning",
    ],
    founder: { "@id": ATTORNEY_ID },
  };
}

export function attorneySchema(): Json {
  return {
    "@type": "Person",
    "@id": ATTORNEY_ID,
    name: firm.attorneyName,
    jobTitle: "Estate planning attorney",
    worksFor: { "@id": ORG_ID },
  };
}

export function websiteSchema(): Json {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: site.url,
    name: firm.brandName,
    publisher: { "@id": ORG_ID },
    inLanguage: "en-US",
  };
}

function servedArea(): Json[] {
  const raw = process.env.SERVED_STATES ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "XX")
    .map((s) => ({ "@type": "State", name: s }));
}

export function breadcrumbSchema(items: { name: string; url: string }[]): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function faqSchema(faqs: Faq[]): Json | null {
  if (!faqs.length) return null;
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function pageBase(page: { url: string; title: string; description: string; updated: string }): Json {
  return {
    "@id": `${absoluteUrl(page.url)}#article`,
    headline: page.title,
    description: page.description,
    url: absoluteUrl(page.url),
    mainEntityOfPage: absoluteUrl(page.url),
    datePublished: page.updated,
    dateModified: page.updated,
    inLanguage: "en-US",
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": SITE_ID },
    // reviewedBy is added once the attorney signs off; until then the page is marked pending review.
    creativeWorkStatus: site.reviewStatus,
  };
}

export function articleSchema(a: Article): Json {
  return {
    "@type": "Article",
    ...pageBase(a),
    articleSection: a.cluster,
    wordCount: a.wordCount,
    abstract: a.answer,
    about: a.glossary.map((g) => ({ "@id": absoluteUrl(`/glossary/${g}#term`) })),
    speakable: { "@type": "SpeakableSpecification", cssSelector: [".answer", ".takeaways"] },
  };
}

export function stateGuideSchema(s: StateGuide): Json {
  return {
    "@type": "Article",
    ...pageBase(s),
    abstract: s.answer,
    spatialCoverage: { "@type": "State", name: s.name },
    speakable: { "@type": "SpeakableSpecification", cssSelector: [".answer"] },
  };
}

export function definedTermSchema(g: GlossaryEntry): Json {
  return {
    "@type": "DefinedTerm",
    "@id": absoluteUrl(`${g.url}#term`),
    name: g.term,
    alternateName: g.also.length ? g.also : undefined,
    description: g.short,
    url: absoluteUrl(g.url),
    inDefinedTermSet: { "@id": absoluteUrl("/glossary#set") },
  };
}

export function definedTermSetSchema(entries: GlossaryEntry[]): Json {
  return {
    "@type": "DefinedTermSet",
    "@id": absoluteUrl("/glossary#set"),
    name: "Estate planning glossary",
    url: absoluteUrl("/glossary"),
    hasDefinedTerm: entries.map((g) => ({ "@id": absoluteUrl(`${g.url}#term`) })),
  };
}

export function cityServiceSchema(c: City): Json {
  return {
    "@type": "Service",
    "@id": `${absoluteUrl(c.url)}#service`,
    serviceType: "Estate planning",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "City", name: `${c.name}, ${c.state.abbr}` },
    url: absoluteUrl(c.url),
  };
}

export function itemListSchema(name: string, items: { name: string; url: string }[]): Json {
  return {
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.url),
    })),
  };
}

/** Wraps nodes in a single @graph document, dropping empty ones. */
export function graph(...nodes: (Json | null | undefined)[]): Json {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}
