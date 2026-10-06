import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import JsonLd from "@/components/JsonLd";
import { PageHero } from "@/components/page-hero";
import PageMeta from "@/components/PageMeta";
import { servedStates } from "@/config/firm";
import { getCities, getClusters, getPillar, getStateGuide } from "@/lib/library";
import { breadcrumbSchema, cityServiceSchema, graph } from "@/lib/schema";

/**
 * City landing pages. Published only for states the firm serves and only for cities with verified
 * local notes in content/cities/{state}.json, so there are no thin, swapped-name doorway pages.
 */

type Params = { state: string; city: string };

export const dynamicParams = false;

function served() {
  const codes = servedStates();
  return getCities().filter((c) => codes.includes(c.state.abbr));
}

export function generateStaticParams(): Params[] {
  const cities = served().map((c) => ({ state: c.state.slug, city: c.slug }));
  // Next needs at least one entry to prerender the segment; the placeholder 404s.
  return cities.length ? cities : [{ state: "_", city: "_" }];
}

function find(state: string, city: string) {
  return served().find((c) => c.state.slug === state && c.slug === city);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { state, city } = await params;
  const c = find(state, city);
  if (!c) return {};
  const title = `Estate planning attorney in ${c.name}, ${c.state.abbr}: wills, trusts and probate`;
  return {
    title,
    description: `Wills, living trusts, powers of attorney and probate help for families in ${c.name} and ${c.county}. Plain answers, flat-fee quotes and a free plan finder.`,
    alternates: { canonical: c.url },
  };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const { state, city } = await params;
  const c = find(state, city);
  if (!c) notFound();
  const guide = getStateGuide(c.state.slug);
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Laws by state", url: "/estate-planning" },
    { name: c.state.name, url: `/estate-planning/${c.state.slug}` },
    { name: c.name, url: c.url },
  ];
  const nearby = served().filter((n) => n.state.slug === c.state.slug && c.nearby.includes(n.slug));

  return (
    <article className="content">
      <JsonLd data={graph(cityServiceSchema(c), breadcrumbSchema(crumbs))} />
      <PageHero
        compact
        crumbs={<Breadcrumbs items={crumbs} />}
        kicker={`${c.state.name} local guide`}
        path={c.url}
        art="HeroFamilyHome"
        title={`Estate planning in ${c.name}, ${c.state.name}`}
        lead={`Wills, trusts, powers of attorney and probate for families in ${c.name} and across ${c.county}.`}
      >
        <PageMeta updated={c.updated} />
      </PageHero>
      <h2>What {c.name} families should know</h2>
      {c.localNotes.map((n) => {
        // Notes cite their official source inline as "(source: https://...)"; show it as a link.
        const m = /\s*\(source: (https?:\/\/[^\s)]+)\)/.exec(n);
        return (
          <p key={n}>
            {m ? n.replace(m[0], "") : n}
            {m && (
              <>
                {" "}
                <a href={m[1]} rel="nofollow noopener" target="_blank">
                  (source)
                </a>
              </>
            )}
          </p>
        );
      })}
      {c.probateCourt && (
        <>
          <h2>Where probate happens for {c.name} residents</h2>
          <p>
            Estates of {c.name} residents are generally handled by the {c.probateCourt.name}
            {c.probateCourt.address ? `, ${c.probateCourt.address}` : ""}.{" "}
            {c.probateCourt.url && <a href={c.probateCourt.url} rel="nofollow">Court website</a>}
          </p>
        </>
      )}
      {guide && (
        <p>
          The rules that apply here come from {c.state.name} law. Read our{" "}
          <Link href={guide.url}>{c.state.name} estate planning guide</Link> for signing requirements, probate options
          and taxes.
        </p>
      )}
      <CtaBox topic={`estate planning in ${c.name}`} />
      <h2>Popular guides</h2>
      <ul className="chips">
        {getClusters()
          .filter((cl) => getPillar(cl.slug))
          .slice(0, 8)
          .map((cl) => (
            <li key={cl.slug}><Link href={cl.url}>{cl.name}</Link></li>
          ))}
      </ul>
      {nearby.length > 0 && (
        <>
          <h2>Nearby</h2>
          <ul className="chips">
            {nearby.map((n) => (
              <li key={n.slug}><Link href={n.url}>{n.name}</Link></li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
