import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS } from "@/config/tools";
import { Breadcrumbs, CardGrid } from "@/components/ui";
import { PageHero } from "@/components/page-hero";
import { JsonLd, abs, breadcrumbLd } from "@/lib/seo";
import EstateTax from "@/components/tools/EstateTax";
import ProbateCost from "@/components/tools/ProbateCost";
import LifeInsurance from "@/components/tools/LifeInsurance";
import GuardianFund from "@/components/tools/GuardianFund";
import MedicaidLookback from "@/components/tools/MedicaidLookback";
import Readiness from "@/components/tools/Readiness";
import ExecutorPlanner from "@/components/tools/ExecutorPlanner";
import ReviewReminder from "@/components/tools/ReviewReminder";
import WillOrTrust from "@/components/tools/WillOrTrust";
import DeathTax from "@/components/tools/DeathTax";
import SmallEstate from "@/components/tools/SmallEstate";
import MedicaidRunway from "@/components/tools/MedicaidRunway";
import BeneficiaryAudit from "@/components/tools/BeneficiaryAudit";
import GuardianPicker from "@/components/tools/GuardianPicker";
import WhoInherits from "@/components/tools/WhoInherits";
import AssetSorter from "@/components/tools/AssetSorter";
import InheritanceTimeline from "@/components/tools/InheritanceTimeline";
import StatePrefill from "@/components/tools/StatePrefill";

const COMPONENTS: Record<string, React.ComponentType> = {
  "estate-tax-estimator": EstateTax,
  "probate-cost-estimator": ProbateCost,
  "life-insurance-needs": LifeInsurance,
  "guardian-fund-calculator": GuardianFund,
  "medicaid-lookback-date": MedicaidLookback,
  "plan-readiness-assessment": Readiness,
  "executor-workload": ExecutorPlanner,
  "plan-review-reminder": ReviewReminder,
  "will-or-trust": WillOrTrust,
  "state-death-tax-checker": DeathTax,
  "small-estate-checker": SmallEstate,
  "medicaid-savings-runway": MedicaidRunway,
  "beneficiary-audit": BeneficiaryAudit,
  "guardian-picker": GuardianPicker,
  "who-inherits": WhoInherits,
  "probate-asset-sorter": AssetSorter,
  "inheritance-timeline": InheritanceTimeline,
};

/** Tools whose first question is the state; they accept ?state=XX (linked from the state guides). */
const STATE_AWARE: Record<string, React.ComponentType<{ initialState?: string }>> = {
  "probate-cost-estimator": ProbateCost,
  "state-death-tax-checker": DeathTax,
  "small-estate-checker": SmallEstate,
  "medicaid-savings-runway": MedicaidRunway,
  "who-inherits": WhoInherits,
  "probate-asset-sorter": AssetSorter,
  "inheritance-timeline": InheritanceTimeline,
};

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = TOOLS.find((x) => x.slug === slug);
  if (!t) return {};
  return { title: t.title, description: t.description, alternates: { canonical: `/tools/${t.slug}` } };
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const t = TOOLS.find((x) => x.slug === slug);
  const Tool = COMPONENTS[slug];
  if (!t || !Tool) notFound();
  return (
    <article>
      <PageHero
        compact
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/tools", label: "Tools" }, { label: t.title }]} />}
        kicker="Planning tool"
        path={`/tools/${t.slug}`}
        title={t.title}
      />
      <div className="answer"><strong>In short</strong>{t.answer}</div>
      {STATE_AWARE[slug] ? <StatePrefill tool={STATE_AWARE[slug]} /> : <Tool />}
      <p className="notice">Estimates are for education only and are not legal, tax or financial advice.</p>
      <h2>More free tools</h2>
      <CardGrid items={TOOLS.filter((x) => x.slug !== slug).slice(0, 4).map((x) => ({ href: `/tools/${x.slug}`, title: x.title, description: x.description }))} />
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "WebApplication", name: t.title, description: t.description, url: abs(`/tools/${t.slug}`), applicationCategory: "FinanceApplication", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }, { name: t.title, path: `/tools/${t.slug}` }]),
        ]}
      />
    </article>
  );
}
