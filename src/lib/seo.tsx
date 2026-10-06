import { firm } from "@/config/firm";

/** Public site URL, used for canonical links, the sitemap and structured data. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.example.com").replace(/\/$/, "");

export function abs(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function articleLd(input: { title: string; description: string; path: string; updated: string; published?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    mainEntityOfPage: abs(input.path),
    datePublished: input.published ?? input.updated,
    dateModified: input.updated,
    author: { "@type": "Person", name: firm.attorneyName, jobTitle: "Estate planning attorney" },
    publisher: { "@type": "LegalService", name: firm.firmLegalName, url: SITE_URL },
  };
}

export function legalServiceLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LegalService",
    name: firm.firmLegalName,
    alternateName: firm.brandName,
    url: SITE_URL,
    telephone: firm.phone,
    address: firm.officeAddress,
    areaServed: (process.env.SERVED_STATES ?? "XX").split(",").map((s) => s.trim()),
    knowsAbout: ["Estate planning", "Wills", "Revocable living trusts", "Powers of attorney", "Probate", "Trust administration"],
    employee: { "@type": "Attorney", name: firm.attorneyName },
  };
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
