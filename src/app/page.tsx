import Link from "next/link";
import ProbateVsTrustAnimation from "@/components/ProbateVsTrustAnimation";
import { firm } from "@/config/firm";

export default function Home() {
  return (
    <>
      <h1>Protect your family with an estate plan written by a real attorney.</h1>
      <p className="lead">
        Answer a few questions in about two minutes and see what people in your situation usually talk through with
        an attorney. Then, if you want, book a call with {firm.attorneyName}.
      </p>
      <p>
        <Link className="button" href="/plan-finder">Start the plan finder</Link>{" "}
        <Link className="button secondary" href="/intake">Book a consult</Link>
      </p>

      <h2>Free tools</h2>
      <ul className="card-grid">
        <li className="card">
          <strong>How ready is your plan?</strong>
          <p>Ten questions, instant score.</p>
          <Link className="button small" href="/tools/readiness">Check my score</Link>
        </li>
        <li className="card">
          <strong>What could probate cost?</strong>
          <p>A rough range for your state.</p>
          <Link className="button small" href="/tools/probate-cost">Estimate it</Link>
        </li>
        <li className="card">
          <strong>Will or trust?</strong>
          <p>See which way your answers point.</p>
          <Link className="button small" href="/tools/will-or-trust">Compare</Link>
        </li>
      </ul>

      <h2>Probate or a trust, in ten seconds</h2>
      <ProbateVsTrustAnimation />

      <h2>How it works</h2>
      <ol className="steps">
        <li><strong>1. Answer a few questions.</strong><br />About your family, your home and what you want to protect.</li>
        <li><strong>2. Talk to our team.</strong><br />We confirm the details and set up a consult at a time that suits you.</li>
        <li><strong>3. Meet your attorney.</strong><br />You get a clear flat-fee quote before anything is signed.</li>
      </ol>

      <h2>What we help with</h2>
      <ul>
        <li>Wills and guardianship for young children</li>
        <li>Revocable living trusts</li>
        <li>Financial and healthcare powers of attorney</li>
        <li>Special needs and blended family planning</li>
        <li>Business succession</li>
        <li>Settling a loved one&apos;s estate</li>
      </ul>

      <h2>Free guides</h2>
      <p>
        Printable checklists for new parents, caregivers, families after a loss and anyone getting started.{" "}
        <Link href="/resources">Browse the guides</Link>.
      </p>
    </>
  );
}
