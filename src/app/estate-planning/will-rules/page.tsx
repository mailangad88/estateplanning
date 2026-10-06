import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { PageHero } from "@/components/page-hero";
import PageMeta from "@/components/PageMeta";
import { absoluteUrl } from "@/config/site";
import { ORG_ID } from "@/lib/seo";
import { breadcrumbSchema, graph } from "@/lib/schema";
import { willRulesTable } from "@/lib/will-rules";

const PATH = "/estate-planning/will-rules";
const TITLE = "Will signing rules in all 50 states: witnesses, handwritten wills and self-proving affidavits";
const DESCRIPTION =
  "A 50-state table of what makes a will valid: how many witnesses, whether a handwritten will counts and whether a self-proving affidavit is available. Free CSV download.";

export const metadata: Metadata = {
  title: "Will signing rules by state (50-state table)",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
};

export default function WillRules() {
  const rows = willRulesTable();
  const updated = rows.map((r) => r.updated).sort().at(-1) ?? "";
  const reviewed = rows.every((r) => r.review === "approved");
  const count = (key: "handwritten" | "selfProving", v: string) => rows.filter((r) => r[key] === v).length;
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Laws by state", url: "/estate-planning" },
    { name: "Will signing rules", url: PATH },
  ];
  const dataset = {
    "@type": "Dataset",
    "@id": `${absoluteUrl(PATH)}#dataset`,
    name: "Will signing rules by US state",
    description: DESCRIPTION,
    url: absoluteUrl(PATH),
    creator: { "@id": ORG_ID },
    isAccessibleForFree: true,
    license: "https://creativecommons.org/licenses/by/4.0/",
    spatialCoverage: { "@type": "Place", name: "United States" },
    dateModified: updated,
    variableMeasured: ["Witnesses required", "Handwritten (holographic) will valid", "Self-proving affidavit available"],
    distribution: { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: absoluteUrl(`${PATH}.csv`) },
  };

  return (
    <article className="content">
      <JsonLd data={graph(dataset, breadcrumbSchema(crumbs))} />
      <PageHero compact crumbs={<Breadcrumbs items={crumbs} />} kicker="State data" path={PATH} art="HeroProbate" title={TITLE}>
        <PageMeta updated={updated} reviewed={reviewed} />
      </PageHero>
      <section className="answer-box" aria-label="Short answer">
        <p className="answer">
          Every state requires a will to be in writing and signed, and {rows.filter((r) => r.witnesses === "2").length} of {rows.length}{" "}
          jurisdictions in this table ask for two witnesses. {count("handwritten", "Yes")} accept a handwritten (holographic) will
          without witnesses, and {count("selfProving", "Yes")} let you add a self-proving affidavit so the witnesses don&apos;t
          have to appear in court later. The full rule for each state is in the table, with a link to its guide.
        </p>
      </section>
      <p>
        <a href={`${PATH}.csv`} download>
          Download the table as CSV
        </a>{" "}
        (free to reuse with a link back to this page). Short answers in the first columns are summaries of the full
        rule. Read the rule itself before relying on it, and confirm current law with an attorney licensed in the
        state.
      </p>
      <div className="table-wrap">
        <table className="facts">
          <thead>
            <tr>
              <th scope="col">State</th>
              <th scope="col">Witnesses</th>
              <th scope="col">Handwritten will without witnesses</th>
              <th scope="col">Self-proving affidavit</th>
              <th scope="col">The rule</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.abbr}>
                <th scope="row">
                  <Link href={r.url}>{r.state}</Link>
                </th>
                <td>{r.witnesses}</td>
                <td>{r.handwritten}</td>
                <td>{r.selfProving}</td>
                <td>
                  {r.signingRule} <strong>Handwritten wills:</strong> {r.handwrittenRule} <strong>Self-proving:</strong> {r.selfProvingRule}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 id="how-to-read">How to read this table</h2>
      <p>
        &quot;Limited&quot; means the state accepts it only in narrow cases, such as a handwritten will made in another state
        where it was valid. &quot;Confirm&quot; means the rule is unsettled or depends on the court, and an attorney should
        check it. A will that was valid where it was signed is usually accepted in other states, but moving is still a
        good reason to have it reviewed.
      </p>
      <p>
        For what makes a will valid everywhere, read <Link href="/learn/wills/how-to-make-a-valid-will">how to make a legally valid will</Link>{" "}
        and <Link href="/learn/wills/handwritten-and-diy-wills">handwritten and DIY wills</Link>. For what happens with no
        will at all, see <Link href="/learn/wills/dying-without-a-will">dying without a will</Link>, or{" "}
        <Link href="/plan-finder">find the plan that fits your family</Link>.
      </p>
    </article>
  );
}
