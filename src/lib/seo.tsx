import { firm, servedStates } from "@/config/firm";
import { SITE_URL } from "@/config/site";

/** Public site URL, used for canonical links, the sitemap and structured data. */
export { SITE_URL };

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

/** True for a firm fact that still holds a placeholder. Placeholders never go into structured data. */
const unfilled = (v: string | null | undefined) => !v || /\[[^\]]*\]|PLACEHOLDER|\(000\) 000-0000/.test(v);

const STATE_NAMES: Record<string, string> = { IL: "Illinois", NJ: "New Jersey" };

/** Served states as schema.org State places, from SERVED_STATES (defaults to the launch state). */
export function servedAreaLd() {
  const names = servedStates().map((c) => STATE_NAMES[c]).filter(Boolean);
  return (names.length ? names : ["Illinois"]).map((name) => ({ "@type": "State", name, containedInPlace: { "@type": "Country", name: "United States" } }));
}

/** The office as a PostalAddress, or undefined while any part is a placeholder. */
export function postalAddressLd() {
  const a = firm.address;
  if ([a.streetAddress, a.addressLocality, a.postalCode].some(unfilled)) return undefined;
  return { "@type": "PostalAddress", ...a };
}

/**
 * The business behind the site. It is a referral network that matches visitors with an attorney, not a law
 * firm, so it is a ProfessionalService rather than a LegalService (Illinois Rule 7.1: don't imply a firm that
 * isn't one). Name, address and phone come only from config/firm.ts and must match the Google Business
 * Profile and every directory listing exactly.
 */
function legalServiceNode() {
  const node: Record<string, unknown> = {
    "@type": ["Organization", "ProfessionalService"],
    "@id": ORG_ID,
    name: unfilled(firm.firmLegalName) ? firm.brandName : firm.firmLegalName,
    alternateName: firm.brandName,
    description: "Estate planning attorney referral network. Matches families with an appropriate attorney for wills, trusts, powers of attorney and probate.",
    url: SITE_URL,
    image: abs("/opengraph-image"),
    areaServed: servedAreaLd(),
    knowsAbout: ["Estate planning", "Wills", "Revocable living trusts", "Powers of attorney", "Probate", "Trust administration"],
    employee: { "@id": ATTORNEY_ID },
  };
  if (!unfilled(firm.phone)) node.telephone = firm.phone;
  if (!unfilled(firm.email)) node.email = firm.email;
  const address = postalAddressLd();
  if (address) node.address = address;
  if (firm.openingHours.length) {
    node.openingHoursSpecification = firm.openingHours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.days, opens: h.opens, closes: h.closes }));
  }
  if (firm.sameAs.length) node.sameAs = firm.sameAs;
  return node;
}

/**
 * The responsible attorney as a Person: the reviewer every approved page points to (reviewedBy).
 * Name and job title only. The site does not publish an attorney bio or credentials.
 */
function attorneyNode() {
  return {
    "@type": "Person",
    "@id": ATTORNEY_ID,
    name: firm.attorneyName,
    jobTitle: firm.attorneyTitle,
  };
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
  // Same @id as the layout's node, so search engines merge the two instead of seeing a second business.
  return { "@context": "https://schema.org", ...legalServiceNode() };
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
