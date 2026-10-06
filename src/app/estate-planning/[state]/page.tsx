import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AnswerBox from "@/components/AnswerBox";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import Faqs from "@/components/Faqs";
import JsonLd from "@/components/JsonLd";
import LinkList from "@/components/LinkList";
import PageMeta from "@/components/PageMeta";
import Toc from "@/components/Toc";
import { servedStates } from "@/config/firm";
import { findByUrl, getCities, getStateGuide, getStateGuides, refToUrl, type StateFacts } from "@/lib/content";
import { breadcrumbSchema, faqSchema, graph, stateGuideSchema } from "@/lib/schema";

type Params = { state: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return getStateGuides().map((s) => ({ state: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { state } = await params;
  const s = getStateGuide(state);
  if (!s) return {};
  return {
    title: s.title,
    description: s.description,
    alternates: { canonical: s.url, types: { "text/markdown": `/raw${s.url}.md` } },
    openGraph: { type: "article", title: s.title, description: s.description, url: s.url, modifiedTime: s.updated },
  };
}

const FACT_LABELS: [keyof StateFacts, string][] = [
  ["willSigning", "Signing a will"],
  ["selfProving", "Self-proving affidavit"],
  ["holographicWills", "Handwritten wills"],
  ["maritalProperty", "Marital property system"],
  ["spousalRights", "Surviving spouse protections"],
  ["intestacy", "No will (married, with children)"],
  ["estateTax", "State estate tax"],
  ["inheritanceTax", "State inheritance tax"],
  ["smallEstate", "Small estate procedure"],
  ["todDeed", "Transfer-on-death deeds"],
  ["probateCourt", "Probate court and code"],
  ["uniformLaws", "Uniform laws adopted"],
];

export default async function StatePage({ params }: { params: Promise<Params> }) {
  const { state } = await params;
  const s = getStateGuide(state);
  if (!s) notFound();

  const served = servedStates().includes(s.abbr);
  const cities = served ? getCities(s.slug) : [];
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Laws by state", url: "/estate-planning" },
    { name: s.name, url: s.url },
  ];
  const related = s.related
    .map((r) => findByUrl(refToUrl(r)))
    .filter((x) => x !== undefined && "title" in x)
    .map((x) => x as { url: string; title: string; description: string });

  return (
    <article className="content">
      <JsonLd data={graph(stateGuideSchema(s), breadcrumbSchema(crumbs), faqSchema(s.faqs))} />
      <Breadcrumbs items={crumbs} />
      <h1>{s.title}</h1>
      <PageMeta updated={s.updated} words={s.wordCount} />
      <AnswerBox answer={s.answer} />
      <section aria-labelledby="facts">
        <h2 id="facts">{s.name} estate planning at a glance</h2>
        <div className="table-wrap">
          <table className="facts">
            <tbody>
              {FACT_LABELS.filter(([k]) => s.facts[k]).map(([k, label]) => (
                <tr key={k}>
                  <th scope="row">{label}</th>
                  <td>{s.facts[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="notice">
          Laws change. Confirm current rules with an attorney licensed in {s.name} before relying on this summary.
        </p>
      </section>
      <Toc headings={s.headings} />
      <div className="prose" dangerouslySetInnerHTML={{ __html: s.html }} />
      <Faqs faqs={s.faqs} />
      {cities.length > 0 && (
        <LinkList
          id="cities"
          title={`Estate planning by city in ${s.name}`}
          items={cities.map((c) => ({ url: c.url, title: `Estate planning in ${c.name}`, description: `${c.county}` }))}
        />
      )}
      {served ? (
        <CtaBox topic={`estate planning in ${s.name}`} />
      ) : (
        <aside className="cta-box">
          <p className="cta-title">Live in {s.name}?</p>
          <p>
            An attorney licensed in {s.name} should prepare your documents. Our <Link href="/plan-finder">plan finder</Link>{" "}
            will tell you whether our firm can help in your state, and the guides below explain the concepts that apply
            everywhere.
          </p>
        </aside>
      )}
      <LinkList id="guides" title="Related guides" items={related.map((r) => ({ url: r.url, title: r.title }))} />
      <p className="back-to-pillar">
        <Link href="/estate-planning">See estate planning rules in other states</Link>
      </p>
    </article>
  );
}
