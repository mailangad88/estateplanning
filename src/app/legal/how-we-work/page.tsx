import { firm } from "@/config/firm";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/ui";

export const metadata = { title: "How we work" };

// DRAFT: must be reviewed and approved by the attorney before launch.
export default function Page() {
  return (
    <>
      <PageHero
        compact
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "How we work" }]} />}
        kicker="Legal"
        path="/legal/how-we-work"
        art="SpotDocumentsSigned"
        title="How we work"
      />
      <p className="notice">Draft pending attorney review.</p>
      <p>{firm.brandName} is the marketing and intake team of {firm.firmLegalName}. When you reach out, a member of our intake team, who is not a lawyer, gathers basic information and schedules a consult with an attorney at the firm.</p>
      <p>Before any confidential details are shared, the firm runs a conflict check. The attorney will give you a flat-fee quote before you decide whether to hire the firm.</p>
    </>
  );
}
