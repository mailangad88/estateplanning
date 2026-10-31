import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import Faqs from "@/components/Faqs";
import JsonLd from "@/components/JsonLd";
import { PageHero } from "@/components/page-hero";
import PageMeta from "@/components/PageMeta";
import { ProbateTimeline } from "@/components/visuals";
import { ILLINOIS_PROBATE_FEES } from "@/config/illinois-probate-fees";
import { absoluteUrl } from "@/config/site";
import { citiesIn, countyFaqs, feesFor, servedCounties, splitSource } from "@/lib/counties";
import { getClusterArticles, getPillar, type Office } from "@/lib/library";
import { breadcrumbSchema, countyServiceSchema, faqSchema, graph, officeSchema } from "@/lib/schema";

/**
 * County probate guides. Same rule as city pages: published only for served states and only for counties
 * with verified notes in content/counties/{state}.json, so no county page is a swapped-name template.
 */

type Params = { state: string; county: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  const counties = servedCounties().map((c) => ({ state: c.state.slug, county: c.slug }));
  return counties.length ? counties : [{ state: "_", county: "_" }];
}

function find(state: string, county: string) {
  return servedCounties(state).find((c) => c.slug === county);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { state, county } = await params;
  const c = find(state, county);
  if (!c) return {};
  return {
    title: `${c.name} probate and estate planning guide (${c.state.abbr})`,
    description: `Where probate is filed in ${c.name}, ${c.state.name}: the courthouse, the clerk, filing fees, where to record a deed or transfer on death instrument, and local help.`,
    alternates: { canonical: c.url },
  };
}

const usd = (n: number) => `$${n}`;

function OfficeRow({ label, o }: { label: string; o?: Office }) {
  if (!o) return null;
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>
        {o.url ? <a href={o.url} rel="nofollow noopener" target="_blank">{o.name}</a> : o.name}
        {o.address && <><br />{o.address}</>}
        {o.phone && <><br />{o.phone}</>}
      </td>
    </tr>
  );
}

export default async function CountyPage({ params }: { params: Promise<Params> }) {
  const { state, county } = await params;
  const c = find(state, county);
  if (!c) notFound();
  const stateUrl = `/estate-planning/${c.state.slug}`;
  const indexUrl = `${stateUrl}/counties`;
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Laws by state", url: "/estate-planning" },
    { name: c.state.name, url: stateUrl },
    { name: "Counties", url: indexUrl },
    { name: c.name, url: c.url },
  ];
  const fees = feesFor(c);
  const il = c.state.abbr === "IL";
  const faqs = countyFaqs(c);
  const cities = citiesIn(c);
  const neighbours = servedCounties(c.state.slug).filter((n) => n.slug !== c.slug);
  const stateGuides = [getPillar(c.state.slug), ...getClusterArticles(c.state.slug)].filter((a) => a !== undefined);
  const maxFee = Math.max(...ILLINOIS_PROBATE_FEES.map((f) => f.estate));
  const offices = [
    officeSchema(c.probateCourt, `${absoluteUrl(c.url)}#court`),
    officeSchema(c.clerk, `${absoluteUrl(c.url)}#clerk`),
    officeSchema(c.recorder, `${absoluteUrl(c.url)}#recorder`),
  ];

  return (
    <article className="content">
      <JsonLd data={graph(countyServiceSchema(c), ...offices, breadcrumbSchema(crumbs), faqSchema(faqs))} />
      <PageHero
        compact
        crumbs={<Breadcrumbs items={crumbs} />}
        kicker={`${c.state.name} county guide`}
        path={c.url}
        art="HeroProbate"
        title={`Probate and estate planning in ${c.name}`}
        lead={`Where estates are opened, where wills are filed and deeds recorded, what the clerk charges, and local help for ${c.name} families.`}
      >
        <PageMeta updated={c.updated} reviewed={false} />
      </PageHero>
      {c.probateCourt && (
        <section className="answer-box" aria-label="Short answer">
          <p className="answer">
            {il ? "Estates" : "Wills"} of {c.name} residents are {il ? "opened in" : "probated by"} the {c.probateCourt.name}
            {c.seat ? ` in ${c.seat}` : ""}.
            {fees && ` The clerk's schedule effective ${fees.effective} lists ${usd(fees.estate)} to open an estate.`}{" "}
            The probate rules themselves come from {c.state.name} law, so the steps are the same in every county; what
            changes is the courthouse, the clerk, the fees and local practice.
          </p>
        </section>
      )}
      <section aria-labelledby="offices">
        <h2 id="offices">{c.name} offices at a glance</h2>
        <div className="table-wrap">
          <table className="facts">
            <tbody>
              {c.seat && <tr><th scope="row">County seat</th><td>{c.seat}</td></tr>}
              {c.circuit && <tr><th scope="row">Court</th><td>{c.circuit}</td></tr>}
              <OfficeRow label={il ? "Probate court" : "Surrogate (wills and estates)"} o={c.probateCourt} />
              <OfficeRow label="Circuit clerk (wills and estate filings)" o={c.clerk} />
              <OfficeRow label={il ? "Recorder (deeds and transfer on death instruments)" : "County clerk (deeds)"} o={c.recorder} />
              {fees && (
                <tr>
                  <th scope="row">Fee to open an estate</th>
                  <td>
                    {usd(fees.estate)} (schedule effective {fees.effective},{" "}
                    <a href={fees.source} rel="nofollow noopener" target="_blank">clerk&apos;s fee schedule</a>)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {fees && (
        <figure className="fee-compare" aria-labelledby="fee-compare-title">
          <figcaption id="fee-compare-title">
            Fee to open a probate estate: {c.name} against other Illinois counties with published schedules
          </figcaption>
          <ul className="bars">
            {[...ILLINOIS_PROBATE_FEES].sort((a, b) => a.estate - b.estate).map((f) => (
              <li key={f.county} className={f === fees ? "bar is-current" : "bar"}>
                <span className="bar-label">{f.county}</span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${(f.estate / maxFee) * 100}%` }} /></span>
                <span className="bar-value">{usd(f.estate)}</span>
              </li>
            ))}
          </ul>
          <p className="notice">
            From each clerk&apos;s own schedule. See the full table and download it at{" "}
            <Link href="/estate-planning/illinois-probate-fees">Illinois probate filing fees by county</Link>.
          </p>
        </figure>
      )}
      <h2>What {c.name} families should know</h2>
      {c.notes.map((n) => {
        const { text, source } = splitSource(n);
        return (
          <p key={n}>
            {text}
            {source && <>{" "}<a href={source} rel="nofollow noopener" target="_blank">(source)</a></>}
          </p>
        );
      })}
      <h2>How probate moves in {c.name}</h2>
      <ProbateTimeline caption={`The usual stages. ${c.state.name} sets the deadlines; the ${c.name} clerk and court handle the filings.`} />
      {il ? (
        <p>
          For the {c.state.name} timeline in detail, read{" "}
          <Link href="/learn/illinois/how-long-does-probate-take-in-illinois">how long probate takes in Illinois</Link> and{" "}
          <Link href="/learn/illinois/illinois-probate-process">the Illinois probate process step by step</Link>. Smaller
          estates may not need court at all: see the{" "}
          <Link href="/learn/illinois/illinois-small-estate-affidavit">Illinois small estate affidavit</Link>, or check with
          the <Link href={`/tools/small-estate-checker?state=${c.state.slug}`}>small estate checker</Link>.
        </p>
      ) : (
        <p>
          The rules come from {c.state.name} law: read our <Link href={stateUrl}>{c.state.name} estate planning guide</Link>{" "}
          for signing rules, probate options and taxes, and see{" "}
          <Link href="/learn/probate/how-to-file-probate">how to file probate</Link> for the steps in order. Smaller
          estates may qualify for a shortcut: check with the{" "}
          <Link href={`/tools/small-estate-checker?state=${c.state.slug}`}>small estate checker</Link>.
        </p>
      )}
      <h2>Free tools for {c.name} families</h2>
      <ul className="chips">
        <li><Link href={`/tools/probate-cost-estimator?state=${c.state.slug}`}>Probate cost estimator</Link></li>
        <li><Link href={`/tools/small-estate-checker?state=${c.state.slug}`}>Small estate checker</Link></li>
        <li><Link href="/plan-finder">Plan finder</Link></li>
        <li><Link href="/decide">Which plan fits you?</Link></li>
      </ul>
      <CtaBox topic={`probate or estate planning in ${c.name}`} />
      <Faqs faqs={faqs} />
      {cities.length > 0 && (
        <>
          <h2>City guides in {c.name}</h2>
          <ul className="chips">
            {cities.map((city) => (
              <li key={city.slug}><Link href={city.url}>{city.name}</Link></li>
            ))}
          </ul>
        </>
      )}
      {stateGuides.length > 0 && (
        <>
          <h2>{c.state.name} guides</h2>
          <ul className="chips">
            {stateGuides.map((a) => (
              <li key={a.url}><Link href={a.url}>{a.title}</Link></li>
            ))}
          </ul>
        </>
      )}
      {neighbours.length > 0 && (
        <>
          <h2>Other {c.state.name} counties</h2>
          <ul className="chips">
            {neighbours.map((n) => (
              <li key={n.slug}><Link href={n.url}>{n.name}</Link></li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
