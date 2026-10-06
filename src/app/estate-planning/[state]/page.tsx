import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStates } from "@/lib/states";
import { Breadcrumbs, Cta, FaqList, ReviewNote } from "@/components/ui";
import { CallbackForm } from "@/components/capture";
import { JsonLd, breadcrumbLd, legalServiceLd } from "@/lib/seo";

type Props = { params: Promise<{ state: string }> };

export function generateStaticParams() {
  return getStates().map((s) => ({ state: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const s = getStates().find((x) => x.slug === state);
  if (!s) return {};
  return {
    title: s.title,
    description: s.description,
    alternates: { canonical: `/estate-planning/${s.slug}` },
    robots: s.indexable ? undefined : { index: false, follow: true },
  };
}

export default async function StatePage({ params }: Props) {
  const { state } = await params;
  const s = getStates().find((x) => x.slug === state);
  if (!s) notFound();
  return (
    <article>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: `Estate planning in ${s.name}` }]} />
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
      <JsonLd data={[{ ...legalServiceLd(), areaServed: s.name }, breadcrumbLd([{ name: "Home", path: "/" }, { name: s.title, path: `/estate-planning/${s.slug}` }])]} />
    </article>
  );
}
