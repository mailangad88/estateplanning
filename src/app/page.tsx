import Link from "next/link";
import { firm } from "@/config/firm";
import { getClusters, getPillar } from "@/lib/content";

export default function Home() {
  return (
    <>
      <h1>Protect your family with an estate plan written by a real attorney.</h1>
      <p className="lead">
        Answer a few questions in about two minutes and see what people in your situation usually talk through with
        an attorney. Then, if you want, book a call with {firm.attorneyName}.
      </p>
      <p>
        <Link className="button" href="/plan-finder">Start the plan finder</Link>
      </p>

      <h2>How it works</h2>
      <ol className="steps">
        <li><strong>1. Answer a few questions.</strong><br />About your family, your home and what you want to protect.</li>
        <li><strong>2. Talk to our team.</strong><br />We confirm the details and set up a consult at a time that suits you.</li>
        <li><strong>3. Meet your attorney.</strong><br />You get a clear flat-fee quote before anything is signed.</li>
      </ol>

      <h2>What we help with</h2>
      <ul>
        <li><Link href="/learn/guardianship">Wills and guardianship for young children</Link></li>
        <li><Link href="/learn/trusts/revocable-living-trust">Revocable living trusts</Link></li>
        <li><Link href="/learn/power-of-attorney">Financial</Link> and <Link href="/learn/healthcare-directives">healthcare</Link> powers of attorney</li>
        <li><Link href="/learn/special-needs">Special needs</Link> and <Link href="/learn/blended-families">blended family</Link> planning</li>
        <li><Link href="/learn/business-owners">Business succession</Link></li>
        <li><Link href="/learn/after-a-death">Settling a loved one&apos;s estate</Link></li>
      </ul>

      <h2>Start with a guide</h2>
      <ul className="chips">
        {getClusters()
          .filter((c) => getPillar(c.slug))
          .map((c) => (
            <li key={c.slug}><Link href={c.url}>{c.name}</Link></li>
          ))}
      </ul>
      <p>
        Or browse <Link href="/learn">every guide</Link>, the <Link href="/glossary">glossary</Link>, and{" "}
        <Link href="/estate-planning">estate planning rules by state</Link>.
      </p>
    </>
  );
}
