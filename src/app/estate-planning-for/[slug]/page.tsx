import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowRight, CircleCheck, Phone } from "lucide-react";
import { firm } from "@/config/firm";
import { lifeStageFor, type LifeStage } from "@/config/life-stages";
import { bySlug, getAudiences, type Audience } from "@/lib/content";
import { resolveAll } from "@/lib/links";
import { ArticlePage } from "@/components/article";
import { Breadcrumbs } from "@/components/ui";
import { Band, FeatureCard, SectionHead, LifeCycle, StageArt, TrustRow } from "@/components/landing";
import {
  HeroBusinessSuccession, HeroEstateSettlement, HeroPowersOfAttorney, HeroSpecialNeeds, HeroTrusts, HeroWills,
} from "@/components/visuals";
import { JsonLd } from "@/lib/seo";
import { stageBoard, stageLibrary } from "@/config/life-game";
import { LifeGame } from "@/components/life-game";

type Props = { params: Promise<{ slug: string }> };

/** Pictures for the situation pages that are not life stages. */
const SITUATION_ART: Partial<Record<string, () => ReactNode>> = {
  "after-a-death": () => <HeroEstateSettlement bare />,
  "after-a-diagnosis": () => <HeroPowersOfAttorney bare />,
  "special-needs-families": () => <HeroSpecialNeeds bare />,
  "small-business-owners": () => <HeroBusinessSuccession bare />,
  "real-estate-investors": () => <HeroTrusts bare />,
  physicians: () => <HeroTrusts bare />,
};

export function generateStaticParams() {
  return getAudiences().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = bySlug(getAudiences(), slug);
  if (!a) return {};
  return { title: a.title, description: a.description, alternates: { canonical: `/estate-planning-for/${a.slug}` } };
}

function crumbs(a: Audience) {
  return <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/estate-planning-for", label: "Estate planning by situation" }, { label: a.title }]} />;
}

function StageHero({ a, stage, digits }: { a: Audience; stage: LifeStage; digits: string }) {
  return (
    <Band className={`stage-hero stage-hero--${stage.tone}${stage.senior ? " is-senior" : ""}`} label="Introduction">
      <div className="hero-x">
        <div>
          {crumbs(a)}
          <p className="kicker">Estate planning for {stage.label.toLowerCase()}</p>
          <h1>{stage.heroTitle}</h1>
          <p className="lead">{stage.heroLead}</p>
          {stage.senior ? (
            <>
              <a className="senior-phone" href={`tel:${digits}`}>
                <Phone size={32} aria-hidden="true" />
                <span>
                  <strong>Call {firm.phone}</strong>
                  <span>Talk to a person. We explain what you need in plain words.</span>
                </span>
              </a>
              <p className="cta-row">
                <Link className="button" href={stage.cta.href}>{stage.cta.label}</Link>
              </p>
            </>
          ) : (
            <p className="cta-row">
              <Link className="button large" href={stage.cta.href}>{stage.cta.label}</Link>
              <a className="button secondary large" href={`tel:${digits}`}>Call {firm.phone}</a>
            </p>
          )}
          <TrustRow
            items={[
              { icon: "Receipt", text: "Flat fee, quoted before you sign" },
              { icon: "Lock", text: "No obligation to hire us" },
            ]}
          />
        </div>
        <div className="art-wrap">
          <StageArt name={stage.illustration} />
        </div>
      </div>
    </Band>
  );
}

function SituationHero({ a, digits, bookHref }: { a: Audience; digits: string; bookHref: string }) {
  const art = SITUATION_ART[a.slug];
  return (
    <Band className={`stage-hero stage-hero--${a.sensitive ? "sage" : "accent"}`} label="Introduction">
      <div className={art ? "hero-x" : ""}>
        <div>
          {crumbs(a)}
          <h1>{a.headline}</h1>
          <p className="lead">{a.description}</p>
          <p className="cta-row no-print">
            <a className="button" href={`tel:${digits}`}>Call {firm.phone}</a>
            <Link className="button secondary" href={bookHref}>Book a consultation</Link>
          </p>
        </div>
        {art && (
          <div className="art-wrap">
            <div className="art-frame">{art()}</div>
          </div>
        )}
      </div>
    </Band>
  );
}

function Hooks({ hooks }: { hooks: string[] }) {
  if (!hooks.length) return null;
  return (
    <ul className="stage-hooks">
      {hooks.map((h) => (
        <li key={h}>
          <CircleCheck size={20} aria-hidden="true" />
          {h}
        </li>
      ))}
    </ul>
  );
}

export default async function AudiencePage({ params }: Props) {
  const { slug } = await params;
  const a = bySlug(getAudiences(), slug);
  if (!a) notFound();
  const path = `/estate-planning-for/${a.slug}`;
  const digits = firm.phone.replace(/\D/g, "");
  // Sensitive pages send visitors to the contact page, not the quiz, so no health or family answers are collected.
  const bookHref = a.sensitive ? "/contact" : "/plan-finder";
  const stage = lifeStageFor(a.slug);
  const tones = ["accent", "clay", "sage"] as const;
  const board = stage ? stageBoard(stage.slug) : null;
  const next = stage && stage.cta.href !== bookHref ? stage.cta : stage?.resource;
  return (
    <div className={stage?.senior ? "is-senior" : undefined}>
      <ArticlePage
        section={{ name: "Estate planning by situation", path: "/estate-planning-for" }}
        path={path}
        title={a.title}
        heading={a.headline}
        description={a.description}
        answer={a.answer}
        updated={a.updated}
        reviewed={a.reviewed}
        html={a.html}
        headings={a.headings}
        faqs={a.faqs}
        sensitive={a.sensitive}
        hero={stage ? <StageHero a={a} stage={stage} digits={digits} /> : <SituationHero a={a} digits={digits} bookHref={bookHref} />}
        before={
          <>
            {stage && board && (
              <Band label="The life game" className="lgame-band">
                <SectionHead
                  kicker="The life game"
                  title="Play the next few years before they happen"
                  lead="Move along the board. At each what-if, plan for it or put it off, and see what usually happens. Your plan builds as you go."
                  center
                />
                <LifeGame squares={board} bookHref={bookHref} phone={firm.phone} next={next} senior={stage.senior} library={stageLibrary(stage.slug)} id={`game-${stage.slug}`} />
              </Band>
            )}
            {stage ? (
              <Band tone="sand" label="What matters most">
                <SectionHead kicker="What matters most right now" title={a.headline} />
                <div className="feature-grid">
                  {stage.priorities.map((p, i) => (
                    <FeatureCard key={p.title} icon={p.icon} tone={tones[i % 3]} title={p.title}>
                      {p.text}
                    </FeatureCard>
                  ))}
                </div>
                {a.hooks.length > 0 && (
                  <>
                    <h3 style={{ margin: "40px 0 16px" }}>Does this sound like you?</h3>
                    <Hooks hooks={a.hooks} />
                  </>
                )}
                <div className="stage-resource">
                  <p>{stage.resource.label}, written for this stage of life.</p>
                  <Link className="arrow-link" href={stage.resource.href}>
                    Get it <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </Band>
            ) : (
              a.hooks.length > 0 && (
                <>
                  <h2>Does this sound like you?</h2>
                  <Hooks hooks={a.hooks} />
                </>
              )
            )}
            <JsonLd
              data={{
                "@context": "https://schema.org",
                "@type": "Service",
                name: a.title,
                serviceType: "Estate planning",
                provider: { "@type": "LegalService", name: firm.firmLegalName },
              }}
            />
          </>
        }
        after={
          stage ? (
            <Band tone="sage" label="Other life stages">
              <SectionHead kicker="Different stage?" title="Where you are in the life cycle" center />
              <LifeCycle current={a.slug} />
            </Band>
          ) : undefined
        }
        magnet={a.magnet ? { interest: a.slug, ...a.magnet } : undefined}
        related={resolveAll(a.related)}
      />
    </div>
  );
}
