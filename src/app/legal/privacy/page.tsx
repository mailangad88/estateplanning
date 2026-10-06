import { firm } from "@/config/firm";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/ui";

export const metadata = { title: "Privacy policy" };

// DRAFT: must be reviewed and approved by the attorney before launch.
export default function Page() {
  return (
    <>
      <PageHero
        compact
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Privacy policy" }]} />}
        kicker="Legal"
        path="/legal/privacy"
        art="SpotDocumentsSigned"
        title="Privacy policy"
      />
      <p className="notice">Draft pending attorney review.</p>
      <p>{firm.firmLegalName} collects the information you give us (contact details, answers about your family and property, and anything you write to us) to respond to your inquiry and, if you choose, to prepare for a consult with an attorney.</p>
      <p>We treat what you tell us as confidential. It is shared only with the attorney who may represent you and with service providers bound by confidentiality agreements who help us run our intake, scheduling and communications. We do not sell your information, and we do not share your answers with advertising platforms.</p>
      <p>Our free tools (the readiness score, probate cost estimator and will-or-trust helper) run in your browser, and we only receive your answers if you submit a form. When you submit a form, we remember your name, email, phone and state on your device so you do not have to type them again; use the &quot;Not you? Clear them&quot; link on any form, or clear your browser storage, to remove them. We also note which page and campaign brought you to the site so we can tell which of our outreach is useful.</p>
      <p>Cookies and analytics: we use analytics and advertising cookies only if you agree in the banner on your first visit. Until you choose, they stay off. We honour the Global Privacy Control setting in your browser by keeping advertising cookies off. You can change your mind at any time with the &quot;Cookie settings&quot; link at the bottom of every page.</p>
      <p>You may ask us to access, correct or delete your information, or to stop contacting you, at any time by calling {firm.phone}.</p>
    </>
  );
}
