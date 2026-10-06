import type { Metadata } from "next";
import Link from "next/link";
import { firm, packages as PACKAGES } from "@/config/firm";
import { Rich, RichFaqList } from "@/components/money-page";
import { Breadcrumbs, Cta, ReviewNote } from "@/components/ui";
import { PageHero } from "@/components/page-hero";
import { breadcrumbLd, JsonLd, abs } from "@/lib/seo";

export const metadata: Metadata = {
  title: "What estate planning costs: flat-fee packages",
  description: `What estate planning costs at ${firm.brandName}: flat fees for wills, living trusts and powers of attorney, what each package includes, and what changes the price.`,
  alternates: { canonical: "/pricing" },
};

const FEE = "[Flat fee]";
const ROWS: string[][] = [
  ["Fits", "One person or a couple, modest assets, no minor children", "Homeowners and families with minor children", "Blended families, business owners, property in more than one state, special needs planning, larger estates"],
  ["Fee, one person", FEE, FEE, "Quote after consult"],
  ["Fee, couple", FEE, FEE, "Quote after consult"],
  ["Will", "Yes", "Pour-over will", "Pour-over will"],
  ["Revocable living trust", "No", "Yes", "Yes, with advanced provisions"],
  ["Durable financial power of attorney", "Yes", "Yes", "Yes"],
  ["Healthcare power of attorney, living will, HIPAA", "Yes", "Yes", "Yes"],
  ["Guardian nominations", "If you have children", "Yes", "Yes"],
  ["Deed for your primary home into the trust", "Not applicable", "Yes", "Yes, plus other properties"],
  ["Funding help (accounts, beneficiaries)", "Checklist", "Checklist plus one review", "[Attorney: define]"],
  ["Special needs trust, business succession coordination", "No", "Optional add-on", "Included or priced in the quote"],
  ["After signing", "[Attorney: question period]", "[Attorney: check-up call]", "[Attorney: annual review period]"],
];

const ADDONS = ["Additional real estate deed", "Pet trust", "Digital assets provisions", "Beneficiary designation review", "Annual review plan", "Remote notary or witness coordination", "Update or amendment to a plan we prepared", "Review of an existing plan (written summary)"];

const FAQS = [
  { q: "Why flat fees instead of hourly?", a: "You know the full cost before you commit, and you can call with questions without watching the clock. Hourly billing suits uncertain or disputed matters, and we say so in advance when something is billed that way." },
  { q: "Does the first consultation cost anything?", a: `Consult fee: ${firm.consultFee}. We state it before you book, and say whether it is credited toward the plan.` },
  { q: "Why is a trust more expensive than a will?", a: "It is more documents and more work: the trust, a pour-over will, a deed and funding instructions. Whether it is worth it depends on probate costs in your state, the property you own and your family. See [will vs trust](/learn/trusts/will-vs-trust)." },
  { q: "What is not included?", a: "Probate, trust administration, litigation and will contests, tax return preparation, Medicaid applications, deeds for property outside the state, and work needed because your situation turns out to be more complex than described. We tell you before doing extra work and quote the difference in writing." },
  { q: "Are there other costs?", a: "Recording a deed costs a county fee, notary or witness fees may apply, and extra complexity may add cost. We list them in the engagement agreement. [Attorney: typical recording fee range in your state]" },
  { q: "Why do online services cost less?", a: "They sell forms. You complete the questions, and nobody checks whether the result fits your facts or your state. Some people are comfortable with that. We charge for the attorney's review and advice. See [online will vs estate attorney](/compare/online-will-vs-estate-attorney)." },
  { q: "Do you offer payment plans?", a: "[Attorney: payment plan terms, or none]. If only the most urgent documents are wanted first, such as a power of attorney and healthcare directive, ask us about doing those on their own." },
  { q: "Do you offer discounts, or update my plan if the law changes?", a: "[Attorney: only offer what is true, for example couple pricing as shown, and your policy on updates]. See [updating your estate plan](/learn/basics/when-to-update-your-estate-plan)." },
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
        We charge flat fees for estate planning, quoted in writing before you pay. A will-based plan starts at {FEE}. A plan with a
        living trust starts at {FEE}. Complex situations such as blended families, business interests or property in more than one
        state are quoted after a short consult. Everything included and excluded is listed below.
      </div>

      <h2>The three packages</h2>
      <ul className="cards">
        {PACKAGES.map((p) => (
          <li key={p.name} className="card">
            <span className="tag">{p.price}</span>
            <h3 style={{ margin: "4px 0" }}>{p.name}</h3>
            <p className="notice">{p.for}</p>
            <ul>{p.includes.map((i) => <li key={i}>{i}</li>)}</ul>
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
      <p className="notice">[Attorney: confirm every row and delete anything the firm will not provide.]</p>
      <p>Complete is the usual fit for families with a home and children. It is not the right package for everyone, and if Essentials fits you, we will say so.</p>

      <h2>What is not included</h2>
      <p>Probate or trust administration (see below), litigation or will contests, tax return preparation, Medicaid applications, deeds for property outside your state, and work needed because your situation turns out to be more complex than described. If that happens we tell you before doing the extra work and quote the difference in writing.</p>

      <h2>Add-ons</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Add-on</th><th scope="col">Fee</th></tr></thead>
          <tbody>{ADDONS.map((a) => <tr key={a}><td>{a}</td><td><Rich text={FEE} /></td></tr>)}</tbody>
        </table>
      </div>

      <h2>Probate and trust administration</h2>
      <p><Rich text="[Attorney: choose the billing model, such as flat fee by estate size, hourly with an estimate, or the statutory schedule where state law applies, and remove the rest.]" /> We give a written estimate after the first consult. Court costs, appraisals and publication fees are paid separately. See <Link href="/probate">probate</Link> and <Link href="/trust-administration">trust administration</Link>.</p>

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
      <p><Rich text="[Attorney: deposit, balance timing, payment plan, accepted payment methods, and how advance fees are held under your state's rules.]" /> You get a receipt.</p>

      <h2>Fee disclaimer</h2>
      <p>Fees depend on the facts of your situation. The fee shown is a starting point and is not an offer. The final fee is stated in your written engagement agreement. Fees do not include court costs, recording fees or third-party charges. No fee is paid to anyone for referring you to us. <Rich text="[Attorney: confirm required fee advertising language for your state]" /></p>
      <p>Prices belong on this page so you do not have to book a call to find out. {firm.attorneyName} sets them. If your situation needs a different price, you hear it before you pay anything.</p>

      <p className="cta-row no-print">
        <Link className="button" href="/plan-finder">Book a consult</Link>
        <Link className="button secondary" href="/wills">Wills</Link>
        <Link className="button secondary" href="/living-trusts">Living trusts</Link>
      </p>
      <RichFaqList faqs={FAQS} />
      <Cta />
      <JsonLd data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]), { "@context": "https://schema.org", "@type": "WebPage", name: "What estate planning costs", url: abs("/pricing") }]} />
    </>
  );
}
