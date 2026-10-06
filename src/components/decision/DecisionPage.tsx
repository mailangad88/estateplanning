import Link from "next/link";
import { ArrowRight, CircleCheck, Phone } from "lucide-react";
import { firm } from "@/config/firm";
import type { DecisionGuide } from "@/config/decisions/types";
import { decisionPath } from "@/config/decisions";
import { diagramRegistry } from "@/components/visuals/diagrams/registry";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs, FaqList, ReviewNote } from "@/components/ui";
import { Band, SectionHead, Steps } from "@/components/landing";
import { articleLd, howToLd, JsonLd } from "@/lib/seo";
import { DecisionPicker } from "./DecisionPicker";
import { DecisionMatrix } from "./DecisionMatrix";
import { DecisionMap, OptionCards, Shortcuts } from "./DecisionVisuals";
import "./decision.css";

/**
 * Visual "which one should I pick?" page. Order: hero, short answer, picker, map, comparison
 * table, a card per option, rules of thumb, how it works, steps, FAQs and a consult band.
 */
export function DecisionPage({ guide }: { guide: DecisionGuide }) {
  const path = decisionPath(guide.slug);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Decision guides", path: "/decide" },
    { name: guide.title, path },
  ];
  const digits = firm.phone.replace(/\D/g, "");
  const diagrams = guide.diagrams.map((n) => diagramRegistry.find((d) => d.name === n)).filter((d) => d !== undefined);
  const n = guide.options.length;
  return (
    <article className="dg">
      <PageHero
        title={guide.h1}
        lead={guide.description}
        kicker={guide.kicker}
        art={guide.art}
        tone={guide.tone}
        path={path}
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/decide", label: "Decision guides" }, { label: guide.title }]} />}
      >
        <p className="cta-row">
          <a className="button large" href="#picker">Find my {guide.noun}</a>
          <a className="button secondary large" href="#compare">Compare all {n}</a>
        </p>
      </PageHero>

      <ReviewNote reviewed={guide.reviewed} updated={guide.updated} />
      <div className="answer dg-answer">
        <strong>Short answer</strong>
        {guide.answer}
      </div>
      <ul className="dg-takeaways">
        {guide.takeaways.map((t) => (
          <li key={t}>
            <CircleCheck size={20} aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>

      <Band tone="sand" id="picker" label={`Which ${guide.noun} fits you`}>
        <div className="dg-split">
          <SectionHead
            kicker={`${guide.questions.length} quick questions`}
            title={`Which ${guide.noun} fits you?`}
            lead="Tap your answers and see which options match your family, with the reasons why. Your answers stay on your device."
          />
          <DecisionPicker guide={guide} />
        </div>
      </Band>

      <Band label={guide.map.title}>
        <SectionHead kicker="See them all at once" title={guide.map.title} lead={guide.map.lead} />
        <DecisionMap guide={guide} />
      </Band>

      <Band tone="sky" id="compare" label="Side-by-side comparison">
        <SectionHead kicker="Side by side" title={`All ${n} compared`} lead="Filter by what you need. Tap a name to jump to the details." />
        <DecisionMatrix guide={guide} />
      </Band>

      <Band label={`Every ${guide.noun} type explained`}>
        <SectionHead kicker="The details" title={`Every ${guide.noun} type, in plain words`} />
        <OptionCards guide={guide} />
      </Band>

      <Band tone="sage" label="Rules of thumb">
        <SectionHead kicker="Quick rules of thumb" title="If this sounds like you, start here" />
        <Shortcuts guide={guide} />
      </Band>

      {diagrams.length > 0 && (
        <Band label="How it works">
          <SectionHead kicker="How it works" title="The picture behind the choice" />
          <div className="dg-diagrams">
            {diagrams.map((d) => (
              <d.component key={d.name} />
            ))}
          </div>
        </Band>
      )}

      <Band tone="sand" label={guide.howTo.name}>
        <SectionHead kicker="Step by step" title={guide.howTo.name} />
        <Steps steps={guide.howTo.steps.map((s) => ({ title: s.name, text: s.text }))} />
      </Band>

      <div className="dg-faq">
        <FaqList faqs={guide.faqs} />
      </div>

      <Band tone="brand" label="Talk to an attorney">
        <div className="dg-cta">
          <div>
            <p className="kicker">Not sure yet?</p>
            <h2>Get a straight answer about your {guide.noun}</h2>
            <p>Bring your picker result to a consult. We confirm what fits under your state&apos;s law and quote a flat fee before anything is signed.</p>
          </div>
          <p className="cta-row">
            <Link className="button large" href="/plan-finder">Book a consult</Link>
            <a className="button secondary large dg-cta__phone" href={`tel:${digits}`}>
              <Phone size={18} aria-hidden="true" /> Call {firm.phone}
            </a>
          </p>
        </div>
      </Band>

      <section className="dg-related" aria-labelledby="dg-related">
        <h2 id="dg-related">Keep reading</h2>
        <ul>
          {guide.related.map((r) => (
            <li key={r.href}>
              <Link href={r.href} className="arrow-link">
                {r.label} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="notice">General information, not legal advice. Trust law differs by state.</p>
      </section>

      <JsonLd data={articleLd({ title: guide.title, description: guide.description, path, updated: guide.updated, reviewed: guide.reviewed, crumbs })} />
      <JsonLd data={howToLd({ name: guide.howTo.name, description: guide.description, steps: guide.howTo.steps })} />
    </article>
  );
}
