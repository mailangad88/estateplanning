import type { Metadata } from "next";
import Link from "next/link";
import ProbateVsTrustAnimation from "@/components/ProbateVsTrustAnimation";
import { firm } from "@/config/firm";
import { TOOLS } from "@/config/tools";
import { EXPLAINERS } from "@/explainers/data";
import { getChecklists, getFaqs, getGuides, getLifeEvents, getPosts } from "@/lib/content";
import { getClusters, getPillar } from "@/lib/library";
import { CardGrid, FaqList } from "@/components/ui";
import { EmailCapture } from "@/components/capture";
import { MAGNET_FORMATS, getMagnets } from "@/lib/magnets";
import { getQuizzes } from "@/lib/quizzes";

const FEATURED_GUIDES = ["what-is-estate-planning", "revocable-living-trust-explained", "guardianship-for-minor-children", "powers-of-attorney", "how-probate-works", "what-happens-if-you-die-without-a-will"];

export const metadata: Metadata = {
  title: { absolute: `Estate planning attorney | ${firm.brandName}` },
  description: `Wills, living trusts and powers of attorney for families, prepared by ${firm.attorneyName}. Flat fees, a clear plan, and a real person on the phone.`,
  alternates: { canonical: "/" },
};

const SITUATIONS = [
  { href: "/wills", title: "I have no will or plan at all", description: "What a will does, and what it cannot do." },
  { href: "/living-trusts", title: "I own a home and have kids", description: "Whether a living trust helps, and when it does not." },
  { href: "/estate-planning-for-parents", title: "My parent is aging and I am worried", description: "The documents that matter first, and how to start the talk." },
  { href: "/probate", title: "Someone I love just died and I am the executor or heir", description: "What to do first, and what has a deadline." },
  { href: "/guides/updating-your-estate-plan", title: "I have a plan but it is old", description: "When a plan is worth reviewing." },
  { href: "/pricing", title: "I just want to know what this costs", description: "Flat fees, shown before you sign." },
];

export default function Home() {
  const guides = getGuides();
  const featured = FEATURED_GUIDES.map((s) => guides.find((g) => g.slug === s)).filter((g) => g !== undefined);
  const faqs = getFaqs().filter((f) => f.category === "Getting started" || f.category === "Cost and process").slice(0, 6);
  return (
    <>
      <section className="hero">
        <h1>Estate planning done by an attorney you can call</h1>
        <div className="answer">
          <strong>In short</strong>
          An estate plan says who makes decisions for you if you cannot, and who gets what if you die. {firm.brandName} prepares
          wills, living trusts, powers of attorney and healthcare directives at flat fees. Start with a two-minute questionnaire,
          or book a call with {firm.attorneyName}.
        </div>
        <p className="cta-row">
          <Link className="button" href="/plan-finder">Start the plan finder</Link>
          <Link className="button secondary" href="/tools/plan-readiness-assessment">Get my readiness score</Link>
          <a className="button secondary" href={`tel:${firm.phone.replace(/\D/g, "")}`}>Call {firm.phone}</a>
        </p>
        <p className="notice">{firm.attorneyName}, Bar No. {firm.barNumber}. Flat fees shown on our <Link href="/pricing">pricing page</Link>. No obligation. Your answers stay confidential.</p>
      </section>

      <h2>Where most people start</h2>
      <CardGrid items={SITUATIONS} />

      <h2>What an estate plan includes</h2>
      <p>Four documents do most of the work. We explain each in plain terms and say when it may not be needed.</p>
      <ul>
        <li><strong><Link href="/wills">A will</Link></strong> names who receives your property, who raises your minor children, and who carries out your wishes. It takes effect only at death and usually goes through probate, the court process that confirms the will and transfers property.</li>
        <li><strong><Link href="/living-trusts">A living trust</Link></strong> holds property under your name as trustee while you are alive and passes it to your beneficiaries without a court process when you die. It does not make sense for everyone. Many families with modest assets and no real estate do fine with a will and beneficiary designations.</li>
        <li><strong><Link href="/power-of-attorney">A durable power of attorney</Link></strong> names someone to handle money and property if you cannot, for example after a stroke. Without one, your family may have to ask a court for authority.</li>
        <li><strong><Link href="/healthcare-directives">Healthcare directives</Link></strong> put your medical wishes in writing and name who speaks for you when you cannot.</li>
      </ul>
      <p>Helping after a death instead? See <Link href="/probate">probate</Link> and <Link href="/trust-administration">trust administration</Link>.</p>

      <h2>What it costs</h2>
      <p>We charge flat fees, quoted before you sign. Essentials fits one person or a couple with modest assets. Complete fits homeowners and families with minor children. Legacy fits blended families, business owners and property in more than one state. Fees depend on the facts of your situation, and the final fee is in your engagement agreement before you pay anything. <Link href="/pricing">See our flat fees</Link>.</p>

      <h2>Start with your life event</h2>
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
        <li><strong>1. Answer a few questions (2 minutes).</strong><br />About your family, your home and what you want to protect.</li>
        <li><strong>2. Talk to our team.</strong><br />We call you {firm.responseTime}, confirm the basics and book a time with the attorney. The team are not lawyers and do not give legal advice.</li>
        <li><strong>3. Meet your attorney.</strong><br />Consult length: {firm.consultLength}. You get a recommendation and a flat-fee quote. Nothing is signed on the call.</li>
        <li><strong>4. Sign and you're done.</strong><br />We guide the signing and help you move assets into your trust.</li>
      </ol>
      <p><Link href="/how-it-works">See what happens on the call</Link> · <Link href="/about-the-attorney">About {firm.attorneyName}</Link></p>

      <h2>When you may not need an attorney</h2>
      <p>People who are single, own very little, have no dependents, and have named beneficiaries on every account often manage with a simple will or beneficiary forms. If you are not sure, the plan finder will say so plainly. Consult fee: {firm.consultFee}.</p>

      <h2>Free downloads</h2>
      <p>Printable worksheets, kits and email courses for every stage of life. <Link href="/free">See all {getMagnets().length}</Link>.</p>
      <CardGrid
        items={["guardian-for-your-kids-worksheet", "estate-planning-checklist", "estate-plan-document-locator", "consult-prep-workbook", "new-parents-5-day-course", "executor-first-30-days-guide"]
          .map((slug) => getMagnets().find((m) => m.slug === slug))
          .filter((m) => m !== undefined)
          .map((m) => ({ href: `/free/${m.slug}`, title: m.title, description: m.promise, tag: `Free ${MAGNET_FORMATS[m.format].toLowerCase()}` }))}
      />

      <h2>Two-minute quizzes</h2>
      <CardGrid items={getQuizzes().slice(0, 6).map((q) => ({ href: `/quizzes/${q.slug}`, title: q.title, description: q.promise, tag: `${q.questions.length} questions` }))} />

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
