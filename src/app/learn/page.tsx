import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaBox from "@/components/CtaBox";
import JsonLd from "@/components/JsonLd";
import { getClusterArticles, getClusters, getPillar } from "@/lib/content";
import { breadcrumbSchema, graph, itemListSchema } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Estate planning guides: wills, trusts, probate and more",
  description:
    "Plain-English estate planning guides from our attorneys: wills, living trusts, probate, powers of attorney, guardianship, taxes and planning for every life stage.",
  alternates: { canonical: "/learn" },
};

export default function LearnHub() {
  const clusters = getClusters().filter((c) => getPillar(c.slug));
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Learn", url: "/learn" },
  ];
  return (
    <div className="content">
      <JsonLd
        data={graph(
          breadcrumbSchema(crumbs),
          itemListSchema("Estate planning guides", clusters.map((c) => ({ name: c.pillarTitle, url: c.url }))),
        )}
      />
      <Breadcrumbs items={crumbs} />
      <h1>Estate planning guides</h1>
      <p className="lead">
        Clear answers to the questions families ask us most, organized by topic. Start with a guide below, or look up
        a term in the <Link href="/glossary">estate planning glossary</Link> or your{" "}
        <Link href="/estate-planning">state&apos;s rules</Link>.
      </p>
      <div className="hub-grid">
        {clusters.map((c) => {
          const pillar = getPillar(c.slug)!;
          const articles = getClusterArticles(c.slug);
          return (
            <section key={c.slug} className="card" aria-labelledby={`h-${c.slug}`}>
              <h2 id={`h-${c.slug}`}><Link href={c.url}>{c.name}</Link></h2>
              <p className="desc">{pillar.description}</p>
              <ul>
                {articles.map((a) => (
                  <li key={a.url}><Link href={a.url}>{a.title}</Link></li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <CtaBox />
    </div>
  );
}
