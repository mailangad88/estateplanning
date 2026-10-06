import { firm } from "@/config/firm";

/** Public site URL, used for canonical links, the sitemap and structured data. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.example.com").replace(/\/$/, "");

export function abs(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Stable node ids so every page can reference the firm and attorney defined once in the layout. */
export const ORG_ID = `${SITE_URL}/#organization`;
export const ATTORNEY_ID = `${SITE_URL}/#attorney`;

function breadcrumbList(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return { "@context": "https://schema.org", ...breadcrumbList(items) };
}

export interface ArticleLdInput {
  title: string;
  description: string;
  path: string;
  updated: string;
  published?: string;
  /** True only when the attorney has reviewed the page. Controls reviewedBy and lastReviewed. */
  reviewed?: boolean;
  /** BlogPosting for blog posts, Article otherwise. */
  type?: "Article" | "BlogPosting";
  crumbs: { name: string; path: string }[];
}

/** One @graph per article page: WebPage, Article or BlogPosting, and BreadcrumbList. The FAQPage block is emitted by the FAQ list. */
export function articleLd(input: ArticleLdInput) {
  const pageId = `${abs(input.path)}#webpage`;
  const articleId = `${abs(input.path)}#article`;
  const webPage: Record<string, unknown> = {
    "@type": "WebPage",
    "@id": pageId,
    url: abs(input.path),
    name: input.title,
    description: input.description,
    dateModified: input.updated,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    breadcrumb: { "@id": `${abs(input.path)}#breadcrumb` },
    mainEntity: { "@id": articleId },
  };
  if (input.reviewed === true) {
    webPage.reviewedBy = { "@id": ATTORNEY_ID };
    webPage.lastReviewed = input.updated;
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      webPage,
      {
        "@type": input.type ?? "Article",
        "@id": articleId,
        headline: input.title,
        description: input.description,
        mainEntityOfPage: { "@id": pageId },
        datePublished: input.published ?? input.updated,
        dateModified: input.updated,
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
      },
      { "@id": `${abs(input.path)}#breadcrumb`, ...breadcrumbList(input.crumbs) },
    ],
  };
}

function legalServiceNode() {
  const node: Record<string, unknown> = {
    "@type": ["Organization", "LegalService"],
    "@id": ORG_ID,
    name: firm.firmLegalName,
    alternateName: firm.brandName,
    url: SITE_URL,
    telephone: firm.phone,
    address: firm.officeAddress,
    areaServed: (process.env.SERVED_STATES ?? "XX").split(",").map((s) => s.trim()),
    knowsAbout: ["Estate planning", "Wills", "Revocable living trusts", "Powers of attorney", "Probate", "Trust administration"],
    employee: { "@id": ATTORNEY_ID },
  };
  if (firm.sameAs.length) node.sameAs = firm.sameAs;
  return node;
}

/** True for a firm fact that still holds its "[...]" placeholder. Placeholders never go into structured data. */
const unfilled = (v: string | null | undefined) => !v || /^\[.*\]$/.test(v.trim());

/**
 * The attorney as a Person: the reviewer every approved page points to (reviewedBy) and the main entity of
 * /about-the-attorney. Credentials are added only once the attorney has supplied them.
 */
function attorneyNode() {
  const node: Record<string, unknown> = {
    "@type": "Person",
    "@id": ATTORNEY_ID,
    name: firm.attorneyName,
    jobTitle: firm.attorneyTitle,
    worksFor: { "@id": ORG_ID },
    url: abs("/about-the-attorney"),
    knowsAbout: ["Estate planning", "Wills", "Living trusts", "Powers of attorney", "Probate", "Trust administration"],
  };
  if (firm.attorneyHeadshot) node.image = abs(firm.attorneyHeadshot);
  if (!unfilled(firm.attorneyShortBio)) node.description = firm.attorneyShortBio;
  if (!unfilled(firm.attorneyBio.education)) node.alumniOf = firm.attorneyBio.education;
  if (!unfilled(firm.barNumber) && !unfilled(firm.licensedState)) {
    node.hasCredential = {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "license",
      name: `Attorney license, ${firm.licensedState}`,
      identifier: firm.barNumber,
      ...(firm.barLookupUrl ? { url: firm.barLookupUrl } : {}),
    };
  }
  const sameAs = [...firm.attorneySameAs, ...(firm.barLookupUrl ? [firm.barLookupUrl] : [])];
  if (sameAs.length) node.sameAs = [...new Set(sameAs)];
  return node;
}

/** Site-wide graph rendered once by the layout: website, firm and attorney. Pages reference these by @id. */
export function siteGraphLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: firm.brandName, publisher: { "@id": ORG_ID } },
      legalServiceNode(),
      attorneyNode(),
    ],
  };
}

/** Standalone firm node for pages that override a field, such as areaServed on state pages. */
export function legalServiceLd() {
  const { "@id": _id, ...node } = legalServiceNode();
  return { "@context": "https://schema.org", ...node, employee: { "@type": "Attorney", name: firm.attorneyName } };
}

export function howToLd(input: { name: string; description: string; steps: { name: string; text: string }[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    step: input.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })),
  };
}

export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
