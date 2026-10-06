import type { ReactNode } from "react";
import { illustrationSrc, topicFor, type Tone } from "@/lib/visual-topic";
import { ICON_MAP } from "@/components/visual-card";

/**
 * Illustrated page hero: words on the left, a large illustration on the right, on a soft tinted band.
 * The picture, icon and colour come from the page's path and title unless `art`/`tone` are given.
 */
export function PageHero({
  title, lead, kicker, crumbs, path, art, tone, children, compact,
}: {
  title: ReactNode;
  lead?: ReactNode;
  kicker?: string;
  crumbs?: ReactNode;
  /** Used with the title to pick an illustration when `art` is not set. */
  path?: string;
  art?: string;
  tone?: Tone;
  /** Buttons or links under the lead. */
  children?: ReactNode;
  /** Smaller type and art, for long reading pages. */
  compact?: boolean;
}) {
  const t = topicFor(path, typeof title === "string" ? title : undefined);
  const src = illustrationSrc(art ?? t.art);
  const Icon = ICON_MAP[t.icon];
  const tn = tone ?? t.tone;
  return (
    <section className={`band page-hero stage-hero stage-hero--${tn}${compact ? " page-hero--compact" : ""}`}>
      <div className="band__inner">
        {crumbs}
        <div className="hero-x">
          <div className="page-hero__text">
            {kicker && (
              <p className="page-hero__kicker">
                {Icon && <span className={`icon-badge icon-badge--${tn === "accent" ? "" : tn}`}><Icon size={18} aria-hidden="true" /></span>}
                {kicker}
              </p>
            )}
            <h1>{title}</h1>
            {lead && <p className="lead">{lead}</p>}
            {children}
          </div>
          <div className="art-wrap page-hero__art" aria-hidden="true">
            <div className="art-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" width={1600} height={960} fetchPriority="high" decoding="async" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
