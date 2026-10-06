import type { Metadata } from "next";
import Link from "next/link";
import { Cta, FaqList, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Flat-fee estate planning pricing",
  description: "Flat-fee estate planning packages: what each includes, and how pricing works.",
  alternates: { canonical: "/pricing" },
};

// PLACEHOLDER prices: the firm sets these. Do not publish until the attorney approves the packages and fees.
const PACKAGES = [
  { name: "Will package", price: "[Flat fee]", for: "Single people or couples with simpler estates who are comfortable with probate.", includes: ["Will (each spouse)", "Guardian nominations for minor children", "Financial power of attorney", "Healthcare power of attorney and living will", "HIPAA release", "Signing ceremony"] },
  { name: "Trust package", price: "[Flat fee]", for: "Homeowners and families who want to avoid probate and keep things private.", includes: ["Revocable living trust", "Pour-over will", "Financial and healthcare powers of attorney", "Living will and HIPAA release", "Deed transfer of your home into the trust", "Funding instructions and checklist", "Signing ceremony"] },
  { name: "Trust plus", price: "[Flat fee]", for: "Blended families, special-needs planning, business owners or property in more than one state.", includes: ["Everything in the trust package", "Special needs or children's trust provisions", "Additional deeds", "Business interest assignment", "Coordination with your financial advisor or CPA"] },
];

export default function Pricing() {
  return (
    <>
      <PageHeader title="Flat-fee pricing" lead="You get a written flat-fee quote after your consult and before you sign anything. No hourly surprises." />
      <ul className="cards">
        {PACKAGES.map((p) => (
          <li key={p.name} className="card">
            <span className="tag">{p.price}</span>
            <h2 style={{ margin: "4px 0" }}>{p.name}</h2>
            <p className="notice">{p.for}</p>
            <ul>{p.includes.map((i) => <li key={i}>{i}</li>)}</ul>
            <Link className="button" href="/plan-finder">Get a quote</Link>
          </li>
        ))}
      </ul>
      <FaqList
        faqs={[
          { q: "Why flat fees instead of hourly?", a: "You know the full cost before you commit, and you can call with questions without watching the clock." },
          { q: "What is not included?", a: "Probate, trust administration, litigation and tax returns are separate services. Your quote will say exactly what is in and out." },
          { q: "Do you offer payment plans?", a: "[Firm to confirm]" },
        ]}
      />
      <Cta />
    </>
  );
}
