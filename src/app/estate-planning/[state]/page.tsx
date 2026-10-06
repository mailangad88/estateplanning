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
import { findByUrl, getCities, getStateGuide, getStateGuides, isIndexable, refToUrl, type StateFacts } from "@/lib/library";
import { breadcrumbSchema, faqSchema, graph, stateGuideSchema } from "@/lib/schema";
import { getStates as getLocalStatePages, type StatePage } from "@/lib/states";
import { Breadcrumbs as UiBreadcrumbs, Cta, FaqList, ReviewNote } from "@/components/ui";
import { CallbackForm } from "@/components/capture";
import { JsonLd as SeoJsonLd, breadcrumbLd, legalServiceLd } from "@/lib/seo";

type Params = { state: string };

/** Tools that read a state, linked with ?state= so the state question is already answered. */
const STATE_TOOLS = [
  { slug: "probate-cost-estimator", title: "Probate cost estimator", description: "What probate could cost here, using this state's rules where they are set by statute." },
  { slug: "state-death-tax-checker", title: "Estate and inheritance tax checker", description: "Whether this state taxes an estate or the heirs, and from what amount." },
  { slug: "small-estate-checker", title: "Small estate checker", description: "Whether a family can use a simpler process instead of full probate." },
  { slug: "medicaid-savings-runway", title: "How long will savings last in a nursing home?", description: "Care costs against savings, with this state's Medicaid rules." },
];

export const dynamicParams = false;

/*
 * Two sources feed this route: the 50-state + DC Markdown guides in content/states/*.md (general state law),
 * and attorney-written local pages in content/states/*.json (courts, counties, local detail) for states the
 * firm serves. When both exist for a state, the guide renders with the local detail added.
 */
export function generateStaticParams(): Params[] {
  const slugs = new Set([...getStateGuides().map((s) => s.slug), ...getLocalStatePages().map((s) => s.slug)]);
  return [...slugs].map((state) => ({ state }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { state } = await params;
  const s = getStateGuide(state);
  if (!s) {
    const local = getLocalStatePages().find((x) => x.slug === state);
    if (!local) return {};
    return {
      title: local.title,
      description: local.description,
      alternates: { canonical: `/estate-planning/${local.slug}` },
      robots: local.indexable ? undefined : { index: false, follow: true },
    };
  }
  return {
    title: s.title,
    description: s.description,
    alternates: { canonical: s.url, types: { "text/markdown": `/raw${s.url}.md` } },
    robots: isIndexable(s) ? undefined : { index: false, follow: true },
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
  const local = getLocalStatePages().find((x) => x.slug === state);
  if (!s) {
    if (!local) notFound();
    return <LocalStatePage s={local} />;
  }

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
      <PageMeta updated={s.updated} words={s.wordCount} reviewed={s.review === "approved"} />
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
      <LinkList
        id="state-tools"
        title={`Run the numbers for ${s.name}`}
        items={STATE_TOOLS.map((t) => ({ url: `/tools/${t.slug}?state=${s.abbr}`, title: t.title, description: t.description }))}
      />
      <Toc headings={s.headings} />
      <div className="prose" dangerouslySetInnerHTML={{ __html: s.html }} />
      {local && local.counties.length > 0 && (
        <section aria-labelledby="courts">
          <h2 id="courts">Probate courts we work with in {s.name}</h2>
          <ul>{local.counties.map((c) => <li key={c.name}><strong>{c.name}:</strong> {c.court}{c.notes ? `. ${c.notes}` : ""}</li>)}</ul>
        </section>
      )}
      {local && local.sections.map((sec) => (
        <section key={sec.heading}>
          <h2>{sec.heading}</h2>
          <p>{sec.body}</p>
        </section>
      ))}
      <Faqs faqs={s.faqs} />
      {served && <CallbackForm interest={`state:${s.abbr}`} />}
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

/** Attorney-written local page for a state that has no Markdown guide (e.g. the template preview). */
function LocalStatePage({ s }: { s: StatePage }) {
  return (
    <article>
      <UiBreadcrumbs items={[{ href: "/", label: "Home" }, { label: `Estate planning in ${s.name}` }]} />
      <h1>{s.title}</h1>
      <ReviewNote reviewed={s.reviewed} updated={s.updated} />
      <div className="answer"><strong>Short answer</strong>{s.answer}</div>
      <h2>{s.name} at a glance</h2>
      <div className="table-wrap">
        <table>
          <tbody>{s.facts.map((f) => <tr key={f.label}><th scope="row">{f.label}</th><td>{f.value}</td></tr>)}</tbody>
        </table>
      </div>
      {s.sections.map((sec) => (
        <section key={sec.heading}>
          <h2>{sec.heading}</h2>
          <p>{sec.body}</p>
        </section>
      ))}
      {s.counties.length > 0 && (
        <section>
          <h2>Probate courts we work with</h2>
          <ul>{s.counties.map((c) => <li key={c.name}><strong>{c.name}:</strong> {c.court}{c.notes ? `. ${c.notes}` : ""}</li>)}</ul>
        </section>
      )}
      <FaqList faqs={s.faqs} />
      <h2>Prefer a call?</h2>
      <CallbackForm interest={`state:${s.code}`} />
      <Cta />
      <SeoJsonLd data={[{ ...legalServiceLd(), areaServed: s.name }, breadcrumbLd([{ name: "Home", path: "/" }, { name: s.title, path: `/estate-planning/${s.slug}` }])]} />
    </article>
  );
}
