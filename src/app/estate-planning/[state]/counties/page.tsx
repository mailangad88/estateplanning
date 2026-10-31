import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import JsonLd from "@/components/JsonLd";
import { PageHero } from "@/components/page-hero";
import { citiesIn, feesFor, servedCounties } from "@/lib/counties";
import { getStates } from "@/lib/library";
import { breadcrumbSchema, graph, itemListSchema } from "@/lib/schema";

type Params = { state: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  const slugs = [...new Set(servedCounties().map((c) => c.state.slug))];
  return slugs.length ? slugs.map((state) => ({ state })) : [{ state: "_" }];
}

function stateOf(slug: string) {
  return servedCounties(slug).length ? getStates().find((s) => s.slug === slug) : undefined;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { state } = await params;
  const s = stateOf(state);
  if (!s) return {};
  return {
    title: `${s.name} probate by county: courts, clerks, fees and recorders`,
    description: `County-by-county probate guides for ${s.name}: where estates are opened, where wills are filed, what each clerk charges and where deeds are recorded.`,
    alternates: { canonical: `/estate-planning/${s.slug}/counties` },
  };
}

export default async function CountiesIndex({ params }: { params: Promise<Params> }) {
  const { state } = await params;
  const s = stateOf(state);
  if (!s) notFound();
  const counties = servedCounties(state).sort((a, b) => a.name.localeCompare(b.name));
  const url = `/estate-planning/${s.slug}/counties`;
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Laws by state", url: "/estate-planning" },
    { name: s.name, url: `/estate-planning/${s.slug}` },
    { name: "Counties", url },
  ];

  return (
    <article className="content">
      <JsonLd data={graph(itemListSchema(`${s.name} county probate guides`, counties.map((c) => ({ name: c.name, url: c.url }))), breadcrumbSchema(crumbs))} />
      <PageHero
        compact
        crumbs={<Breadcrumbs items={crumbs} />}
        kicker={`${s.name} local guides`}
        path={url}
        art="HeroProbate"
        title={`${s.name} probate by county`}
        lead="Where estates are opened, where wills are filed, what the clerk charges and where deeds are recorded, county by county."
      />
      <p>
        Probate law is the same across {s.name}, but each county has its own courthouse, clerk, fees and recorder. Pick
        your county, meaning the county where the person who died lived.
      </p>
      <div className="table-wrap">
        <table className="facts">
          <thead>
            <tr>
              <th scope="col">County</th>
              <th scope="col">County seat</th>
              <th scope="col">Fee to open an estate</th>
              <th scope="col">City guides</th>
            </tr>
          </thead>
          <tbody>
            {counties.map((c) => {
              const fees = feesFor(c);
              const cities = citiesIn(c);
              return (
                <tr key={c.slug}>
                  <th scope="row"><Link href={c.url}>{c.name}</Link></th>
                  <td>{c.seat ?? ""}</td>
                  <td>{fees ? `$${fees.estate}` : "See guide"}</td>
                  <td>{cities.map((city, i) => <span key={city.slug}>{i > 0 && ", "}<Link href={city.url}>{city.name}</Link></span>)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {s.abbr === "IL" && (
        <p>
          Compare filing fees side by side in <Link href="/estate-planning/illinois-probate-fees">Illinois probate filing
          fees by county</Link>.
        </p>
      )}
      <CtaBox topic={`probate in ${s.name}`} />
    </article>
  );
}
