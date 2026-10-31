import type { Metadata } from "next";
import Link from "next/link";
import { fees, firm, packages as PACKAGES, services } from "@/config/firm";
import { Rich, RichFaqList } from "@/components/money-page";
import { Breadcrumbs, Cta, ReviewNote } from "@/components/ui";
import { PageHero } from "@/components/page-hero";
import { breadcrumbLd, JsonLd, abs } from "@/lib/seo";

export const metadata: Metadata = {
  title: "What estate planning costs: flat-fee packages",
  description: `What estate planning costs at ${firm.brandName}: flat fees for wills, living trusts and powers of attorney, what each package includes, and what changes the price.`,
  alternates: { canonical: "/pricing" },
};

/** Ends a firm.ts value as a sentence, whether or not the value carries its own full stop. */
const end = (v: string) => (/[.!?]$/.test(v.trim()) ? v.trim() : `${v.trim()}.`);

const ROWS: string[][] = [
  ["Fits", "One person or a couple, modest assets, no minor children", "Homeowners and families with minor children", "Blended families, business owners, property in more than one state, special needs planning, larger estates"],
  ["Fee, one person", fees.essentialsOne, fees.completeOne, "Quote after consult"],
  ["Fee, couple", fees.essentialsCouple, fees.completeCouple, "Quote after consult"],
  ["Will", "Yes", "Pour-over will", "Pour-over will"],
  ["Revocable living trust", "No", "Yes", "Yes, with advanced provisions"],
  ["Durable financial power of attorney", "Yes", "Yes", "Yes"],
  ["Healthcare power of attorney, living will, HIPAA", "Yes", "Yes", "Yes"],
  ["Guardian nominations", "If you have children", "Yes", "Yes"],
  ["Deed for your primary home into the trust", "Not applicable", "Yes", "Yes, plus other properties"],
  ["Funding help (accounts, beneficiaries)", "Checklist", "Checklist plus one review", "Checklist plus one review"],
  ["Revisions to your documents", "One round", "One round", "One round"],
  ["Special needs trust, business succession coordination", "No", "Optional add-on", "Included or priced in the quote"],
  ["After signing", services.afterSigning, services.afterSigning, services.afterSigning],
];

const ADDONS = ["Additional real estate deed", "Pet trust", "Digital assets provisions", "Beneficiary designation review", "Annual review plan", "Remote notary or witness coordination", "Update or amendment to an existing plan", "Review of an existing plan (written summary)"];

const FAQS = [
  { q: "Why flat fees instead of hourly?", a: "You know the full cost before you commit, and you can call with questions without watching the clock. Hourly billing suits uncertain or disputed matters, and the attorney says so in advance when something is billed that way." },
  { q: "Does the first consultation cost anything?", a: `Consult fee: ${firm.consultFee}. You see it before you book, and the attorney tells you whether it is credited toward the plan.` },
  { q: "Why is a trust more expensive than a will?", a: "It is more documents and more work: the trust, a pour-over will, a deed and funding instructions. Whether it is worth it depends on probate costs in your state, the property you own and your family. See [will vs trust](/learn/trusts/will-vs-trust)." },
  { q: "What is not included?", a: "Probate, trust administration, litigation and will contests, tax return preparation, Medicaid applications, deeds for property outside the state, and work needed because your situation turns out to be more complex than described. The attorney tells you before doing extra work and quotes the difference in writing." },
  { q: "Are there other costs?", a: "Recording a deed costs a county recording fee, which differs by county in Illinois and New Jersey. Notary or witness fees may apply, and extra complexity may add cost. The engagement agreement lists them." },
  { q: "Why do online services cost less?", a: "They sell forms. You complete the questions, and nobody checks whether the result fits your facts or your state. Some people are comfortable with that. An attorney's fee pays for review and advice. See [online will vs estate attorney](/compare/online-will-vs-estate-attorney)." },
  { q: "Do you offer payment plans?", a: `${end(services.paymentPlans)} If only the most urgent documents are wanted first, such as a power of attorney and healthcare directive, ask about doing those on their own.` },
  { q: "Do you offer discounts, or update my plan if the law changes?", a: "Couple pricing is shown above. Ask the attorney you are matched with how they handle updates when the law changes. See [updating your estate plan](/learn/basics/when-to-update-your-estate-plan)." },
];

export default function Pricing() {
  return (
    <>
      <PageHero
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Pricing" }]} />}
        kicker="Pricing"
        path="/pricing"
        art="SpotCalendarReview"
        title="What estate planning costs"
      >
        <ReviewNote reviewed={false} updated="October 2026" />
        <p className="cta-row no-print">
          <Link className="button" href="/plan-finder">Start the plan finder</Link>
          <Link className="button secondary" href="/how-it-works">See what happens on the call</Link>
        </p>
      </PageHero>
      <div className="answer">
        <strong>In short</strong>
        Attorneys in our network charge flat fees for estate planning, quoted in writing before you pay. A will-based plan starts at{" "}
        {fees.essentialsOne}. A plan with a living trust starts at {fees.completeOne}. Complex situations such as blended families, business interests or property in more than one
        state are quoted after a short consult. Everything included and excluded is listed below.
      </div>

      <h2>The three packages</h2>
      <ul className="cards price-tiers">
        {PACKAGES.map((p) => (
          <li key={p.name} className={`card price-tier${p.id === "complete" ? " is-featured" : ""}`}>
            <span className="tag">{p.price}</span>
            <h3>{p.name}</h3>
            <p className="notice">{p.for}</p>
            <ul className="price-tier__list">{p.includes.map((i) => <li key={i}>{i}</li>)}</ul>
            <Link className="button" href="/plan-finder">Get a quote</Link>
          </li>
        ))}
      </ul>

      <h2>Compare the packages</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th scope="col"></th>{PACKAGES.map((p) => <th key={p.name} scope="col">{p.name}</th>)}</tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]}>
                <th scope="row">{r[0]}</th>
                {r.slice(1).map((c, i) => <td key={i}><Rich text={c} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Complete is the usual fit for families with a home and children. It is not the right package for everyone, and if Essentials fits you, the attorney should say so.</p>

      <h2>What is not included</h2>
      <p>Probate or trust administration (see below), litigation or will contests, tax return preparation, Medicaid applications, deeds for property outside your state, and work needed because your situation turns out to be more complex than described. If that happens, the attorney tells you before doing the extra work and quotes the difference in writing.</p>

      <h2>Add-ons</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Add-on</th><th scope="col">Fee</th></tr></thead>
          <tbody>{ADDONS.map((a) => <tr key={a}><td>{a}</td><td><Rich text={fees.addOn} /></td></tr>)}</tbody>
        </table>
      </div>

      <h2>Probate and trust administration</h2>
      <p><Rich text={end(services.probate)} /> The attorney gives a written estimate after the first consult. Trustee help is priced separately: a trustee consult is <Rich text={fees.trusteeConsult} />, guided administration <Rich text={fees.guidedTrustAdministration} />, and full administration <Rich text={fees.fullTrustAdministration} />. Court costs, appraisals and publication fees are paid separately. See <Link href="/probate">probate</Link> and <Link href="/trust-administration">trust administration</Link>.</p>

      <h2>What changes the price</h2>
      <ul>
        <li>A second or third property, or property in another state</li>
        <li>A blended family or children from earlier relationships</li>
        <li>A beneficiary with special needs</li>
        <li>A business, rental properties or large retirement accounts</li>
        <li>Tax planning for estates near the federal exemption (see <Link href="/guides/estate-and-inheritance-taxes">estate and inheritance taxes</Link>)</li>
        <li>Documents that need to be fixed after a divorce, death or move</li>
      </ul>
      <p>The <Link href="/tools/probate-cost-estimator">probate cost estimator</Link> and the <Link href="/tools/will-or-trust">will or trust comparison</Link> help you see which way your situation points before you call.</p>

      <h2>How you pay</h2>
      <p><Rich text={end(services.paymentPlans)} /> Before you sign, the attorney explains the deposit, when the balance is due, which payment methods they accept, and how advance fees are held under Illinois or New Jersey rules. You get a receipt.</p>

      <h2>Fee disclaimer</h2>
      <p>Fees depend on the facts of your situation. The fee shown is a starting point and is not an offer. The final fee is stated in your written engagement agreement. Fees do not include court costs, recording fees or third-party charges.</p>
      <p>Prices belong on this page so you do not have to book a call to find out. If your situation needs a different price, you hear it before you pay anything.</p>

      <p className="cta-row no-print">
        <Link className="button" href="/book?from=pricing">Book a consult</Link>
        <Link className="button secondary" href="/wills">Wills</Link>
        <Link className="button secondary" href="/living-trusts">Living trusts</Link>
      </p>
      <RichFaqList faqs={FAQS} />
      <Cta />
      <JsonLd data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]), { "@context": "https://schema.org", "@type": "WebPage", name: "What estate planning costs", url: abs("/pricing") }]} />
    </>
  );
}
