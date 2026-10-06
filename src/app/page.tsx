import Link from "next/link";
import ProbateVsTrustAnimation from "@/components/ProbateVsTrustAnimation";
import { firm } from "@/config/firm";
import { TOOLS } from "@/config/tools";
import { EXPLAINERS } from "@/explainers/data";
import { getChecklists, getFaqs, getGuides, getLifeEvents, getPosts } from "@/lib/content";
import { getClusters, getPillar } from "@/lib/library";
import { CardGrid, FaqList } from "@/components/ui";
import { EmailCapture } from "@/components/capture";

const FEATURED_GUIDES = ["what-is-estate-planning", "revocable-living-trust-explained", "guardianship-for-minor-children", "powers-of-attorney", "how-probate-works", "what-happens-if-you-die-without-a-will"];

export default function Home() {
  const guides = getGuides();
  const featured = FEATURED_GUIDES.map((s) => guides.find((g) => g.slug === s)).filter((g) => g !== undefined);
  const faqs = getFaqs().filter((f) => f.category === "Getting started" || f.category === "Cost and process").slice(0, 6);
  return (
    <>
      <section className="hero">
        <h1>Protect your family with an estate plan written by a real attorney.</h1>
        <p className="lead">
          Wills, trusts and powers of attorney, explained in plain English. Answer a few questions in about two minutes,
          see what people in your situation usually put in place, and book a call with {firm.attorneyName} if you want one.
        </p>
        <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button" href="/plan-finder">Start the plan finder</Link>
          <Link className="button secondary" href="/tools/plan-readiness-assessment">Get my readiness score</Link>
        </p>
        <p className="notice">Flat-fee quote before you sign anything · No obligation · Your answers stay confidential</p>
      </section>

      <h2>Start where you are</h2>
      <CardGrid items={getLifeEvents().map((l) => ({ href: `/life-events/${l.slug}`, title: l.event, description: l.description }))} />

      <h2>Browse the library by topic</h2>
      <ul className="pill-row">
        {getClusters()
          .filter((c) => getPillar(c.slug))
          .map((c) => (
            <li key={c.slug}><Link href={c.url}>{c.name}</Link></li>
          ))}
      </ul>
      <p>
        Or see <Link href="/learn">every guide in the library</Link> and{" "}
        <Link href="/estate-planning">estate planning rules by state</Link>.
      </p>

      <h2>Probate or a trust, in ten seconds</h2>
      <ProbateVsTrustAnimation />

      <h2>How it works</h2>
      <ol className="steps">
        <li><strong>1. Answer a few questions.</strong><br />About your family, your home and what you want to protect.</li>
        <li><strong>2. Talk to our team.</strong><br />We confirm the details and set up a consult at a time that suits you.</li>
        <li><strong>3. Meet your attorney.</strong><br />You get a clear flat-fee quote before anything is signed.</li>
        <li><strong>4. Sign and you're done.</strong><br />We guide the signing and help you move assets into your trust.</li>
      </ol>

      <h2>Most-read guides</h2>
      <CardGrid items={featured.map((g) => ({ href: `/guides/${g.slug}`, title: g.title, description: g.description, tag: `${g.readingMinutes} min read` }))} />
      <p><Link href="/guides">All {guides.length} guides</Link> · <Link href="/blog">{getPosts().length} questions answered</Link> · <Link href="/compare">Comparisons</Link></p>

      <h2>Free tools</h2>
      <CardGrid items={TOOLS.slice(0, 6).map((t) => ({ href: `/tools/${t.slug}`, title: t.title, description: t.description, tag: "Free tool" }))} />

      <h2>Watch: how it works in two minutes</h2>
      <CardGrid items={EXPLAINERS.slice(0, 3).map((e) => ({ href: `/explainers/${e.slug}`, title: e.title, description: e.description, tag: "Animated" }))} />

      <EmailCapture
        kind="course"
        interest="7-day-course"
        title="Free course: your estate plan in 7 days"
        body="One short lesson and one small task a day, so you walk into a consult ready. Plus our 12 printable checklists."
        cta="Start the free course"
        success="You're in. Lesson 1 is on its way."
      />

      <h2>Printable checklists</h2>
      <ul className="pill-row">
        {getChecklists().map((c) => <li key={c.slug}><Link href={`/checklists/${c.slug}`}>{c.title}</Link></li>)}
      </ul>

      <FaqList faqs={faqs} />
      {/* Client reviews go here once real clients leave them. Never use invented testimonials. */}
    </>
  );
}
