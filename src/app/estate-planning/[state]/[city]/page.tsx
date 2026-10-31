import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import AnswerBox from "@/components/AnswerBox";
import { FaqList } from "@/components/ui";
import { ProbateTimeline } from "@/components/visuals";
import { countyFaqs, feesFor } from "@/lib/counties";
import { faqsFor } from "@/lib/page-faqs";
import JsonLd from "@/components/JsonLd";
import { PageHero } from "@/components/page-hero";
import PageMeta from "@/components/PageMeta";
import { servedStates } from "@/config/firm";
import { countyForCity, getCities, getClusters, getPillar, getStateGuide } from "@/lib/library";
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
  const county = countyForCity(c);
  const nearby = served().filter((n) => n.state.slug === c.state.slug && c.nearby.includes(n.slug));
  const fees = county ? feesFor(county) : undefined;
  const court = c.probateCourt;
  const short =
    `${c.name} is in ${c.county}. Wills, trusts and powers of attorney signed here follow ${c.state.name} law` +
    (court ? `, and estates of ${c.name} residents are generally opened in the ${court.name}` : "") +
    (fees ? `, where the clerk's schedule lists $${fees.estate} to open a decedent's estate` : "") +
    ".";
  // Answers from the verified county data first, then the library's answers about probate in this state.
  const localFaqs = county ? countyFaqs(county) : [];
  const faqs = [
    ...localFaqs,
    ...faqsFor({ url: c.url, topic: `${c.state.name} probate`, context: "will trust estate court executor", clusters: [c.state.slug, "probate"], limit: 6 }),
  ].slice(0, Math.max(5, localFaqs.length));

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
      <AnswerBox answer={short} label="In short" />
      <div className="table-wrap">
        <table>
          <caption>{c.name} at a glance</caption>
          <tbody>
            <tr><th scope="row">County</th><td>{county ? <Link href={county.url}>{c.county}</Link> : c.county}</td></tr>
            <tr><th scope="row">State law that applies</th><td>{guide ? <Link href={guide.url}>{c.state.name}</Link> : c.state.name}</td></tr>
            {court && (
              <tr><th scope="row">Probate court</th><td>{court.name}{court.address ? `, ${court.address}` : ""}</td></tr>
            )}
            {fees && (
              <tr><th scope="row">Clerk&apos;s fee to open an estate</th><td>${fees.estate} (schedule effective {fees.effective}; confirm with the clerk)</td></tr>
            )}
            <tr><th scope="row">Talk to an attorney</th><td><Link href={`/book?from=city-${c.slug}`}>Book a consult</Link></td></tr>
          </tbody>
        </table>
      </div>
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
      {county && (
        <p>
          Courthouse, clerk, recorder and filing fees for the whole county are in our{" "}
          <Link href={county.url}>{county.name} probate guide</Link>.
        </p>
      )}
      {guide && (
        <p>
          The rules that apply here come from {c.state.name} law. Read our{" "}
          <Link href={guide.url}>{c.state.name} estate planning guide</Link> for signing requirements, probate options
          and taxes.
        </p>
      )}
      <ProbateTimeline caption={`The usual stages of probate. ${c.state.name} sets the deadlines; the ${c.county} clerk and court handle the filings.`} />
      <FaqList faqs={faqs} title={`Questions ${c.name} families ask`} />
      <CtaBox topic={`estate planning in ${c.name}`} from={`city-${c.slug}`} />
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
