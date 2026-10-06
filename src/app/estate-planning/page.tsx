import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { getStateGuides } from "@/lib/library";
import { breadcrumbSchema, graph, itemListSchema } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Estate planning laws by state: wills, probate and taxes",
  description:
    "State-by-state guides to will signing rules, probate, small estate limits, transfer-on-death deeds and state estate or inheritance taxes for all 50 states and DC.",
  alternates: { canonical: "/estate-planning" },
};

export default function StatesIndex() {
  const guides = getStateGuides();
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Laws by state", url: "/estate-planning" },
  ];
  return (
    <div className="content">
      <JsonLd
        data={graph(
          breadcrumbSchema(crumbs),
          itemListSchema("Estate planning laws by state", guides.map((g) => ({ name: g.name, url: g.url }))),
        )}
      />
      <Breadcrumbs items={crumbs} />
      <h1>Estate planning laws by state</h1>
      <p className="lead">
        Wills, probate and taxes are governed by state law. Pick your state for its signing rules, probate shortcuts and
        tax position, then read our <Link href="/learn">national guides</Link> for the concepts behind them.
      </p>
      <ul className="state-grid">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={g.url}>{g.name}</Link>
          </li>
        ))}
      </ul>
      <h2>Which states have an estate or inheritance tax?</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">State</th>
              <th scope="col">Estate tax</th>
              <th scope="col">Inheritance tax</th>
            </tr>
          </thead>
          <tbody>
            {guides
              .filter((g) => isTaxed(g.facts.estateTax) || isTaxed(g.facts.inheritanceTax))
              .map((g) => (
                <tr key={g.slug}>
                  <th scope="row"><Link href={g.url}>{g.name}</Link></th>
                  <td>{g.facts.estateTax}</td>
                  <td>{g.facts.inheritanceTax}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="notice">
        Every other state has neither tax. See{" "}
        <Link href="/learn/estate-tax/state-estate-and-inheritance-taxes">state estate and inheritance taxes</Link> for
        how they work.
      </p>
    </div>
  );
}

function isTaxed(v: string | undefined): boolean {
  return !!v && !/^none\b/i.test(v.trim()) && !/^no\b/i.test(v.trim());
}
