import Link from "next/link";
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
        <li>Wills and guardianship for young children</li>
        <li>Revocable living trusts</li>
        <li>Financial and healthcare powers of attorney</li>
        <li>Special needs and blended family planning</li>
        <li>Business succession</li>
        <li>Settling a loved one&apos;s estate</li>
      </ul>
    </>
  );
}
