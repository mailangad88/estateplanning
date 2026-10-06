import { absoluteUrl, site } from "@/config/site";
import { ATTORNEY_ID as SEO_ATTORNEY_ID, ORG_ID as SEO_ORG_ID } from "@/lib/seo";
import type { Article, City, Faq, GlossaryEntry, StateGuide } from "@/lib/library";

/**
 * schema.org JSON-LD builders. Entities reference each other by @id so search engines and
 * AI crawlers can connect every page to the same firm, website and attorney.
 */

type Json = Record<string, unknown>;

// The firm, attorney and website nodes are emitted once per page by siteGraphLd() in src/lib/seo.tsx
// (root layout). This file only references them, so the firm is one entity everywhere.
const ORG_ID = SEO_ORG_ID;
const SITE_ID = `${site.url}/#website`;
const ATTORNEY_ID = SEO_ATTORNEY_ID;

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

function pageBase(page: { url: string; title: string; description: string; updated: string; review?: "pending" | "approved" }): Json {
  const approved = page.review === "approved";
  return {
    "@id": `${absoluteUrl(page.url)}#article`,
    headline: page.title,
    description: page.description,
    url: absoluteUrl(page.url),
    // reviewedBy and lastReviewed belong to WebPage, so the attorney sign-off goes on the page node. It is
    // added only once the attorney approves the page (review: approved in the frontmatter).
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(page.url),
      ...(approved ? { reviewedBy: { "@id": ATTORNEY_ID }, lastReviewed: page.updated } : {}),
    },
    datePublished: page.updated,
    dateModified: page.updated,
    inLanguage: "en-US",
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": SITE_ID },
    // Share image from the page's opengraph-image route: Google uses it for Article rich results and Discover.
    image: { "@type": "ImageObject", url: absoluteUrl(`${page.url}/opengraph-image`), width: 1200, height: 630 },
    creativeWorkStatus: approved ? "Attorney reviewed" : site.reviewStatus,
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
