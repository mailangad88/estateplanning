import Link from "next/link";
import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import type { DecisionGuide } from "@/config/decisions/types";
import { iconFor } from "./icons";

const toneOf = (guide: DecisionGuide, family: string) => guide.families.find((f) => f.id === family)?.tone ?? "accent";

/**
 * Every option placed on two axes the guide defines (for trusts: control kept against protection
 * and tax power). Bubbles link to the option's card. Phones show numbered dots with a key below.
 */
export function DecisionMap({ guide, anchorBase = "" }: { guide: DecisionGuide; anchorBase?: string }) {
  const { map } = guide;
  return (
    <figure className="dg-map">
      <div className="dg-map__plot" role="img" aria-label={`${map.title}: ${map.lead}`}>
        <span className="dg-map__axis dg-map__axis--y" aria-hidden="true">
          <span>{map.y.low}</span>
          <span>{map.y.high}</span>
        </span>
        <div className="dg-map__field">
          {guide.options.map((o, i) => {
            const Icon = iconFor(o.icon);
            return (
              <a
                key={o.id}
                href={`${anchorBase}#opt-${o.id}`}
                className={`dg-bubble dg-tone--${toneOf(guide, o.family)}`}
                style={{ left: `${o.map.x}%`, top: `${100 - o.map.y}%` }}
                aria-label={o.name}
              >
                <span className="dg-bubble__dot">
                  <Icon size={18} aria-hidden="true" />
                  <span className="dg-bubble__n" aria-hidden="true">{i + 1}</span>
                </span>
                <span className="dg-bubble__label">{o.short ?? o.name}</span>
              </a>
            );
          })}
        </div>
        <span className="dg-map__axis dg-map__axis--x" aria-hidden="true">
          <span>{map.x.low}</span>
          <span>{map.x.high}</span>
        </span>
      </div>
      <ol className="dg-map__key">
        {guide.options.map((o) => (
          <li key={o.id}>
            <a href={`${anchorBase}#opt-${o.id}`}>{o.name}</a>
          </li>
        ))}
      </ol>
      <figcaption className="dg-map__families">
        {guide.families.map((f) => (
          <span key={f.id} className={`dg-swatch dg-tone--${f.tone}`}>
            {f.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** A card per option, grouped by family, each with who it suits and what to watch for. */
export function OptionCards({ guide }: { guide: DecisionGuide }) {
  return (
    <div className="dg-families">
      {guide.families.map((f) => {
        const opts = guide.options.filter((o) => o.family === f.id);
        if (!opts.length) return null;
        return (
          <section key={f.id} className={`dg-family dg-tone--${f.tone}`} aria-labelledby={`fam-${f.id}`}>
            <header className="dg-family__head">
              <h3 id={`fam-${f.id}`}>{f.name}</h3>
              <p>{f.text}</p>
            </header>
            <div className="dg-cards">
              {opts.map((o) => {
                const Icon = iconFor(o.icon);
                return (
                  <article key={o.id} id={`opt-${o.id}`} className="dg-card">
                    <div className="dg-card__top">
                      <span className={`dg-icon dg-icon--md dg-tone--${f.tone}`}>
                        <Icon size={24} aria-hidden="true" />
                      </span>
                      <h4>{o.name}</h4>
                    </div>
                    <p className="dg-card__what">{o.what}</p>
                    <p className="dg-card__label">Good fit for</p>
                    <ul className="dg-ticks">
                      {o.bestFor.map((b) => (
                        <li key={b}>
                          <CircleCheck size={17} aria-hidden="true" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <p className="dg-card__label">Watch out for</p>
                    <ul className="dg-ticks dg-ticks--warn">
                      {o.watchOut.map((w) => (
                        <li key={w}>
                          <TriangleAlert size={17} aria-hidden="true" />
                          {w}
                        </li>
                      ))}
                    </ul>
                    {o.learn && (
                      <Link href={o.learn.href} className="arrow-link dg-card__more">
                        {o.learn.label} <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** "If this, then consider that" rules of thumb, each linking to the option card. */
export function Shortcuts({ guide, anchorBase = "" }: { guide: DecisionGuide; anchorBase?: string }) {
  return (
    <ol className="dg-shortcuts">
      {guide.shortcuts.map((s) => {
        const o = guide.options.find((x) => x.id === s.pick);
        if (!o) return null;
        const Icon = iconFor(o.icon);
        return (
          <li key={s.when}>
            <span className="dg-shortcuts__if">
              <span className="dg-shortcuts__tag">If</span>
              {s.when}
            </span>
            <ArrowRight className="dg-shortcuts__arrow" size={22} aria-hidden="true" />
            <a href={`${anchorBase}#opt-${o.id}`} className={`dg-chip dg-tone--${toneOf(guide, o.family)}`}>
              <Icon size={18} aria-hidden="true" />
              <strong>{o.name}</strong>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
