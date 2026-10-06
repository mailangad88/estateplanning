import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProbateVsTrustAnimation from "@/components/ProbateVsTrustAnimation";
import { firm, packages } from "@/config/firm";
import { TOOLS } from "@/config/tools";
import { videos } from "@/components/visuals/video/videos";
import { getChecklists, getFaqs, getGuides, getLifeEvents, getPosts } from "@/lib/content";
import { getClusters, getPillar } from "@/lib/library";
import { CardGrid, FaqList } from "@/components/ui";
import { EmailCapture } from "@/components/capture";
import { MAGNET_FORMATS, getMagnets } from "@/lib/magnets";
import { getQuizzes } from "@/lib/quizzes";
import { HeroFamilyHome, SpotVideoCall } from "@/components/visuals";
import { lifeBoard } from "@/config/life-game";
import { LifeGame } from "@/components/life-game";
import { Band, FeatureCard, IconBadge, LifeCycle, SectionHead, Steps, TrustRow } from "@/components/landing";

const FEATURED_GUIDES = ["what-is-estate-planning", "revocable-living-trust-explained", "guardianship-for-minor-children", "powers-of-attorney", "how-probate-works", "what-happens-if-you-die-without-a-will"];

export const metadata: Metadata = {
  title: { absolute: `Estate planning attorney | ${firm.brandName}` },
  description: `Wills, living trusts and powers of attorney for families, prepared by ${firm.attorneyName}. Flat fees, a clear plan, and a real person on the phone.`,
  alternates: { canonical: "/" },
};

const FEATURED_VIDEOS = ["how-a-revocable-living-trust-works", "what-happens-if-you-die-without-a-will", "will-vs-trust-a-decision-tree", "executor-vs-trustee-vs-power-of-attorney", "guardianship-for-minor-children-how-courts-decide", "first-30-days-after-a-loved-one-dies"];

const SITUATIONS = [
  { href: "/wills", title: "I have no will or plan at all", description: "What a will does, and what it cannot do.", image: "/media/illustrations/HeroWills.webp" },
  { href: "/living-trusts", title: "I own a home and have kids", description: "Whether a living trust helps, and when it does not.", image: "/media/illustrations/HeroFamilyHome.webp" },
  { href: "/estate-planning-for-parents", title: "My parent is aging and I am worried", description: "The documents that matter first, and how to start the talk." },
  { href: "/probate", title: "Someone I love just died and I am the executor or heir", description: "What to do first, and what has a deadline." },
  { href: "/guides/updating-your-estate-plan", title: "I have a plan but it is old", description: "When a plan is worth reviewing." },
  { href: "/pricing", title: "I just want to know what this costs", description: "Flat fees, shown before you sign." },
];

const TOOL_ICONS: Record<string, string> = { "plan-readiness-assessment": "BadgeCheck", "will-or-trust": "Scale", "probate-cost-estimator": "Receipt" };

export default function Home() {
  const guides = getGuides();
  const featured = FEATURED_GUIDES.map((s) => guides.find((g) => g.slug === s)).filter((g) => g !== undefined);
  const faqs = getFaqs().filter((f) => f.category === "Getting started" || f.category === "Cost and process").slice(0, 6);
  const heroTools = ["plan-readiness-assessment", "will-or-trust", "probate-cost-estimator"].map((s) => TOOLS.find((t) => t.slug === s)).filter((t) => t !== undefined);
  return (
    <>
      <Band className="hero-band" label="Introduction">
        <div className="hero-x">
          <div>
            <Link href="/plan-finder" className="eyebrow">
              <b>2 minutes</b> Find the plan that fits your family <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <h1>
              Protect the people you love, <em>in plain English.</em>
            </h1>
            <p className="lead">
              Wills, living trusts and powers of attorney at flat fees, explained plainly, with {firm.attorneyName} on the phone.
            </p>
            <p className="cta-row">
              <Link className="button large" href="/plan-finder">Start the plan finder</Link>
              <Link className="button secondary large" href="/tools/plan-readiness-assessment">Get my readiness score</Link>
            </p>
            <TrustRow
              items={[
                { icon: "Receipt", text: "Flat fee, quoted before you sign" },
                { icon: "BadgeCheck", text: "Prepared by an estate planning attorney" },
                { icon: "Lock", text: "Your answers stay confidential" },
              ]}
            />
          </div>
          <div className="art-wrap">
            <div className="art-frame">
              <HeroFamilyHome bare />
            </div>
            <p className="float-note float-note--a" aria-hidden="true">
              <IconBadge name="Baby" tone="gold" size={18} /> Guardian named for the kids
            </p>
            <p className="float-note float-note--b" aria-hidden="true">
              <IconBadge name="ShieldCheck" tone="sage" size={18} /> Home kept out of probate court
            </p>
          </div>
        </div>
      </Band>

      <Band label="Plans by life stage">
        <SectionHead
          kicker="Start where you are"
          title="Your plan changes as your life does"
          lead="Pick the stage closest to yours."
          center
        />
        <LifeCycle />
        <p className="cycle-more">
          <Link href="/estate-planning-for" className="arrow-link">
            Other situations: business owners, special needs, military, after a death <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </p>
      </Band>

      <Band tone="sand" label="The life game" className="lgame-band">
        <SectionHead
          kicker="The life game"
          title="What could go wrong if your plan waits?"
          lead="Seven stages of life, one what-if at each. Plan for it or put it off, and watch your family's plan fill in."
          center
        />
        <LifeGame squares={lifeBoard()} bookHref="/plan-finder" phone={firm.phone} next={{ label: "Find the right plan in two minutes", href: "/plan-finder" }} id="game-life" />
      </Band>

      <Band label="What a plan includes">
        <SectionHead kicker="What you get" title="Four documents do most of the work" center />
        <CardGrid
          media="art"
          items={[
            { href: "/wills", title: "A will", description: "Who gets what, and who raises your kids.", image: "/media/illustrations/HeroWills.webp" },
            { href: "/living-trusts", title: "A living trust", description: "Keeps your home out of probate court.", image: "/media/illustrations/HeroTrusts.webp" },
            { href: "/power-of-attorney", title: "A power of attorney", description: "Someone you trust handles the money.", image: "/media/illustrations/HeroPowersOfAttorney.webp" },
            { href: "/healthcare-directives", title: "Healthcare directives", description: "Your medical wishes, in writing.", image: "/media/illustrations/SpotDocumentsSigned.webp" },
          ]}
        />
        <p className="band-foot">
          Helping after a death instead? See <Link href="/probate">probate</Link> and <Link href="/trust-administration">trust administration</Link>.
        </p>
      </Band>

      <Band tone="sand" label="How it works">
        <div className="split">
          <div>
            <SectionHead kicker="How it works" title="From first question to signed plan, in four steps" />
            <Steps
              vertical
              steps={[
                { title: "Answer a few questions", text: "About two minutes, online." },
                { title: "Talk to our team", text: `We call you ${firm.responseTime} to book your consult.` },
                { title: "Meet your attorney", text: "Get a recommendation and a flat-fee quote." },
                { title: "Sign and you're done", text: "We guide the signing and the follow-through." },
              ]}
            />
            <p className="cta-row" style={{ marginTop: 32 }}>
              <Link href="/how-it-works" className="arrow-link">See what happens on the call <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/about-the-attorney" className="arrow-link">About {firm.attorneyName} <ArrowRight size={16} aria-hidden="true" /></Link>
            </p>
          </div>
          <div className="art-frame">
            <SpotVideoCall bare />
          </div>
        </div>
      </Band>

      <Band tone="brand" label="Free tools">
        <SectionHead kicker="Free tools" title="Honest answers before you talk to anyone" lead="They tell you plainly when you do not need us." />
        <div className="feature-grid">
          {heroTools.map((t) => (
            <FeatureCard key={t.slug} icon={TOOL_ICONS[t.slug] ?? "Check"} title={t.title} href={`/tools/${t.slug}`} cta="Try it">
              {t.description}
            </FeatureCard>
          ))}
        </div>
        <p style={{ marginTop: 28 }}>
          <Link href="/tools">All {TOOLS.length} free tools</Link> · <Link href="/quizzes">{getQuizzes().length} two-minute quizzes</Link> · <Link href="/checklists">Printable checklists</Link>
        </p>
      </Band>

      <Band tone="sand" label="Pricing">
        <SectionHead
          kicker="Flat fees"
          title="Know the price before you start"
          lead={<>Fees depend on your situation, and the final fee is in your engagement agreement before you pay anything. <Link href="/pricing">See our flat fees</Link>.</>}
        />
        <div className="tier-grid">
          {packages.map((p) => (
            <div key={p.name} className={`tier${p.name === "Complete" ? " is-featured" : ""}`}>
              <h3>{p.name}</h3>
              <p>{p.for}</p>
              <ul>
                {p.includes.slice(0, 4).map((i) => <li key={i}>{i}</li>)}
              </ul>
              <Link className={`button${p.name === "Complete" ? "" : " secondary"}`} href="/pricing">See what is included</Link>
            </div>
          ))}
        </div>
      </Band>

      <Band label="Probate or a trust">
        <div className="split">
          <div>
            <SectionHead kicker="In ten seconds" title="Probate or a trust?" lead="A will usually goes through a court process called probate. A funded living trust usually does not." />
            <div className="honest">
              <IconBadge name="HandHeart" tone="sage" />
              <div>
                <h3>When you may not need an attorney</h3>
                <p>
                  People who are single, own very little, have no dependents, and have named beneficiaries on every account often
                  manage with a simple will or beneficiary forms. If you are not sure, the plan finder will say so plainly. Consult fee: {firm.consultFee}.
                </p>
              </div>
            </div>
          </div>
          <div className="feature-card">
            <ProbateVsTrustAnimation />
          </div>
        </div>
      </Band>

      <Band tone="clay" label="Free downloads">
        <SectionHead kicker="Free downloads" title="Worksheets, kits and email courses" lead={<Link href="/free">See all {getMagnets().length} free resources</Link>} />
        <CardGrid
          items={["guardian-for-your-kids-worksheet", "estate-planning-checklist", "estate-plan-document-locator", "consult-prep-workbook", "new-parents-5-day-course", "executor-first-30-days-guide"]
            .map((slug) => getMagnets().find((m) => m.slug === slug))
            .filter((m) => m !== undefined)
            .map((m) => ({ href: `/free/${m.slug}`, title: m.title, tag: `Free ${MAGNET_FORMATS[m.format].toLowerCase()}` }))}
        />
        <EmailCapture
          kind="course"
          interest="7-day-course"
          title="Free course: your estate plan in 7 days"
          body="One short lesson and one small task a day, so you walk into a consult ready."
          cta="Start the free course"
          success="You're in. Lesson 1 is on its way."
        />
      </Band>

      <Band label="Watch">
        <SectionHead kicker="Watch" title="Short videos, plain answers" lead={<Link href="/videos">All {videos.length} videos</Link>} />
        <CardGrid items={FEATURED_VIDEOS.map((slug) => videos.find((v) => v.slug === slug)).filter((v) => v !== undefined).map((v) => ({ href: `/videos/${v.slug}`, title: v.title, tag: "Video" }))} />
      </Band>

      <Band tone="sky" label="Where people start">
        <SectionHead kicker="Common starting points" title="Where most people start" />
        <CardGrid media="art" items={SITUATIONS} />
        <h3 className="band-subhead">Or start with a life event</h3>
        <ul className="pill-row">
          {getLifeEvents().map((l) => <li key={l.slug}><Link href={`/life-events/${l.slug}`}>{l.event}</Link></li>)}
        </ul>
      </Band>

      <Band label="Learn">
        <SectionHead
          kicker="Learn at your own pace"
          title="Most-read guides"
          lead={<><Link href="/guides">All {guides.length} guides</Link> · <Link href="/blog">{getPosts().length} questions answered</Link> · <Link href="/compare">Comparisons</Link> · <Link href="/estate-planning">Rules by state</Link></>}
        />
        <CardGrid items={featured.map((g) => ({ href: `/guides/${g.slug}`, title: g.title, tag: `${g.readingMinutes} min read` }))} />
        <h3 className="band-subhead">Browse by topic</h3>
        <ul className="pill-row">
          {getClusters()
            .filter((c) => getPillar(c.slug))
            .map((c) => (
              <li key={c.slug}><Link href={c.url}>{c.name}</Link></li>
            ))}
          <li><Link href="/learn">Everything in the library</Link></li>
        </ul>
        <h3 className="band-subhead">Quizzes and checklists</h3>
        <ul className="pill-row">
          {getQuizzes().slice(0, 4).map((q) => <li key={q.slug}><Link href={`/quizzes/${q.slug}`}>{q.title}</Link></li>)}
          {getChecklists().slice(0, 4).map((c) => <li key={c.slug}><Link href={`/checklists/${c.slug}`}>{c.title}</Link></li>)}
          <li><Link href="/explainers">Animated explainers</Link></li>
        </ul>
      </Band>

      <FaqList faqs={faqs} />
      {/* Client reviews go here once real clients leave them. Never use invented testimonials. */}
    </>
  );
}
