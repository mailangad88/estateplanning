import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { PageHero } from "@/components/page-hero";
import PageMeta from "@/components/PageMeta";
import { absoluteUrl } from "@/config/site";
import { FEES_NOT_FOUND, ILLINOIS_PROBATE_FEES, RESEARCHED_ON } from "@/config/illinois-probate-fees";
import { ORG_ID } from "@/lib/seo";
import { breadcrumbSchema, graph } from "@/lib/schema";

const PATH = "/estate-planning/illinois-probate-fees";
const TITLE = "Illinois probate filing fees by county";
const DESCRIPTION =
  "What Illinois circuit clerks charge to open a probate estate, file an appearance and file a will, from each county's own fee schedule. Free CSV download.";

export const metadata: Metadata = {
  title: "Illinois probate filing fees by county (2026 table)",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
};

const usd = (n: number | null) => (n === null ? "Not listed" : n === 0 ? "No fee" : `$${n}`);
const date = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function IllinoisProbateFees() {
  const rows = [...ILLINOIS_PROBATE_FEES].sort((a, b) => a.estate - b.estate);
  const low = rows[0];
  const high = rows.at(-1)!;
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Laws by state", url: "/estate-planning" },
    { name: "Illinois", url: "/estate-planning/illinois" },
    { name: "Probate fees by county", url: PATH },
  ];
  const dataset = {
    "@type": "Dataset",
    "@id": `${absoluteUrl(PATH)}#dataset`,
    name: "Illinois probate filing fees by county",
    description: DESCRIPTION,
    url: absoluteUrl(PATH),
    creator: { "@id": ORG_ID },
    isAccessibleForFree: true,
    license: "https://creativecommons.org/licenses/by/4.0/",
    spatialCoverage: { "@type": "Place", name: "Illinois, United States" },
    dateModified: RESEARCHED_ON,
    variableMeasured: ["Decedent estate filing fee", "Appearance fee", "Will filing fee"],
    distribution: { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: absoluteUrl(`${PATH}.csv`) },
  };

  return (
    <article className="content">
      <JsonLd data={graph(dataset, breadcrumbSchema(crumbs))} />
      <PageHero compact crumbs={<Breadcrumbs items={crumbs} />} kicker="Illinois data" path={PATH} art="HeroProbate" title={TITLE}>
        <PageMeta updated={RESEARCHED_ON} reviewed={false} />
      </PageHero>
      <section className="answer-box" aria-label="Short answer">
        <p className="answer">
          Opening a probate estate in Illinois costs ${low.estate} to ${high.estate} in court filing fees across the{" "}
          {rows.length} counties in this table, from {low.county} County to {high.county} County. Most of these clerks charge
          nothing to file a will. Filing fees are only part of the cost of probate: publication, bond premiums and
          attorney fees usually cost more.
        </p>
      </section>
      <p>
        <a href={`${PATH}.csv`} download>
          Download the table as CSV
        </a>{" "}
        (free to reuse with a link back to this page). Each figure comes from the county clerk&apos;s published fee
        schedule, linked in the last column. Clerks change their fees often, so confirm the amount with the clerk before
        you file.
      </p>
      <div className="table-wrap">
        <table className="facts">
          <thead>
            <tr>
              <th scope="col">County</th>
              <th scope="col">Open an estate</th>
              <th scope="col">Appearance</th>
              <th scope="col">File a will</th>
              <th scope="col">Schedule</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.county}>
                <th scope="row">{r.county}</th>
                <td>{usd(r.estate)}</td>
                <td>{usd(r.appearance)}</td>
                <td>{usd(r.will)}</td>
                <td>
                  <a href={r.source} rel="nofollow noopener" target="_blank">
                    Effective {date(r.effective)}
                  </a>
                  {r.note ? ` ${r.note}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 id="missing">Counties not in the table yet</h2>
      <p>
        We could not read a current fee schedule online for {FEES_NOT_FOUND.join(", ")} counties. Call the circuit
        clerk in those counties for the current amount. We add counties as their schedules are confirmed.
      </p>
      <h2 id="what-else">What else probate costs in Illinois</h2>
      <p>
        The filing fee is usually the smallest part of the bill. Read{" "}
        <Link href="/learn/illinois/illinois-probate-costs">what probate costs in Illinois</Link> for publication,
        bond and attorney fees, and{" "}
        <Link href="/learn/illinois/illinois-small-estate-affidavit">the Illinois small estate affidavit</Link> to see
        whether you can skip probate entirely. The{" "}
        <Link href="/learn/illinois/illinois-probate-process">Illinois probate process</Link> explains each step, or{" "}
        <Link href="/tools/probate-cost-estimator">estimate your total probate cost</Link>. For the whole picture, see the{" "}
        <Link href="/learn/illinois">Illinois estate planning guide</Link>.
      </p>
    </article>
  );
}
