import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight, Baby, Compass, BadgeCheck, Briefcase, CalendarCheck, Check, FileText, HandHeart, Heart, House, Landmark, Lock, Phone,
  PiggyBank, Receipt, Scale, ShieldCheck, Stethoscope, Sun, Users, type LucideIcon,
} from "lucide-react";
import {
  HeroAgingParents, HeroBlendedFamily, HeroFamilyHome, HeroGuardianship, HeroNewlyweds, HeroPreRetirees, HeroRetirees,
} from "@/components/visuals";
import { LIFE_STAGES, type LifeStage, type StageIllustration } from "@/config/life-stages";

export const ICONS: Record<string, LucideIcon> = {
  Baby, BadgeCheck, Briefcase, CalendarCheck, Check, FileText, HandHeart, Heart, House, Landmark, Lock, Phone, PiggyBank,
  Receipt, Scale, ShieldCheck, Stethoscope, Sun, Users,
};

const ART: Record<StageIllustration, () => ReactNode> = {
  newlyweds: () => <HeroNewlyweds bare />,
  guardianship: () => <HeroGuardianship bare />,
  familyHome: () => <HeroFamilyHome bare />,
  blendedFamily: () => <HeroBlendedFamily bare />,
  preRetirees: () => <HeroPreRetirees bare />,
  retirees: () => <HeroRetirees bare />,
  agingParents: () => <HeroAgingParents bare />,
};

export function StageArt({ name }: { name: StageIllustration }) {
  return <div className="art-frame">{ART[name]()}</div>;
}

/** Full-width band that breaks out of the reading column. */
export function Band({ tone = "plain", children, className = "", id, label }: { tone?: "plain" | "sand" | "brand" | "sage" | "clay" | "sky"; children: ReactNode; className?: string; id?: string; label?: string }) {
  return (
    <section className={`band band--${tone} ${className}`} id={id} aria-label={label}>
      <div className="band__inner">{children}</div>
    </section>
  );
}

export function SectionHead({ kicker, title, lead, center }: { kicker?: string; title: string; lead?: ReactNode; center?: boolean }) {
  return (
    <header className={`section-head${center ? " is-center" : ""}`}>
      {kicker && <p className="kicker">{kicker}</p>}
      <h2>{title}</h2>
      {lead && <p className="section-lead">{lead}</p>}
    </header>
  );
}

export function IconBadge({ name, tone = "accent", size = 22 }: { name: string; tone?: string; size?: number }) {
  const Icon = ICONS[name] ?? Check;
  return (
    <span className={`icon-badge icon-badge--${tone}`}>
      <Icon size={size} aria-hidden="true" />
    </span>
  );
}

/** Honest proof points. No ratings, client counts or awards until they exist and are approved. */
export function TrustRow({ items }: { items: { icon: string; text: string }[] }) {
  return (
    <ul className="trust-row">
      {items.map((i) => {
        const Icon = ICONS[i.icon] ?? Check;
        return (
          <li key={i.text}>
            <Icon size={18} aria-hidden="true" />
            {i.text}
          </li>
        );
      })}
    </ul>
  );
}

export function FeatureCard({ icon, tone, title, children, href, cta }: { icon: string; tone?: string; title: string; children: ReactNode; href?: string; cta?: string }) {
  return (
    <div className="feature-card">
      <IconBadge name={icon} tone={tone} />
      <h3>{title}</h3>
      <p>{children}</p>
      {href && (
        <Link href={href} className="arrow-link">
          {cta ?? "Learn more"} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function Steps({ steps, vertical }: { steps: { title: string; text: ReactNode }[]; vertical?: boolean }) {
  return (
    <ol className={`step-track${vertical ? " is-vertical" : ""}`}>
      {steps.map((s, i) => (
        <li key={s.title}>
          <span className="step-track__n" aria-hidden="true">{i + 1}</span>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Life cycle view ---------- */

const CYCLE = { w: 1180, h: 840, cx: 590, cy: 400, rx: 450, ry: 300 };

function cyclePoint(i: number, n: number, offset = 0) {
  const a = ((-90 + ((i + offset) * 360) / n) * Math.PI) / 180;
  return { x: CYCLE.cx + CYCLE.rx * Math.cos(a), y: CYCLE.cy + CYCLE.ry * Math.sin(a), a };
}

/**
 * The life stages as one loop through life, from a new couple to helping aging parents, which is
 * where the next generation's plan begins. Desktop shows a ring around the plan finder; phones get
 * the same list as a vertical timeline. `current` marks the stage page the reader is on.
 */
export function LifeCycle({ current }: { current?: string }) {
  const n = LIFE_STAGES.length;
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
  return (
    <div className="cycle">
      <svg className="cycle__ring" viewBox={`0 0 ${CYCLE.w} ${CYCLE.h}`} aria-hidden="true" focusable="false">
        <ellipse cx={CYCLE.cx} cy={CYCLE.cy} rx={CYCLE.rx} ry={CYCLE.ry} className="cycle__track" />
        <ellipse cx={CYCLE.cx} cy={CYCLE.cy} rx={CYCLE.rx} ry={CYCLE.ry} className="cycle__flow" />
        {LIFE_STAGES.map((s, i) => {
          // A chevron halfway to the next stage, pointing along the ring (clockwise).
          const { x, y, a } = cyclePoint(i, n, 0.5);
          const tangent = (Math.atan2(CYCLE.ry * Math.cos(a), -CYCLE.rx * Math.sin(a)) * 180) / Math.PI;
          return <path key={s.slug} d="M -7 -9 L 5 0 L -7 9" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tangent.toFixed(1)})`} className="cycle__chevron" />;
        })}
      </svg>
      <ol className="cycle__list">
        {LIFE_STAGES.map((s, i) => {
          const { x, y } = cyclePoint(i, n);
          const Icon = ICONS[s.icon] ?? Heart;
          const here = s.slug === current;
          return (
            <li key={s.slug} className={`cycle__item${i === 0 ? " is-top" : ""}`} style={{ ["--x" as string]: pct(x, CYCLE.w), ["--y" as string]: pct(y, CYCLE.h) }}>
              <Link href={`/estate-planning-for/${s.slug}`} className={`cycle-node cycle-node--${s.tone}${here ? " is-current" : ""}`} aria-current={here ? "page" : undefined}>
                <span className="cycle-node__dot">
                  <Icon size={26} aria-hidden="true" />
                  <span className="cycle-node__n" aria-hidden="true">{i + 1}</span>
                </span>
                <span className="cycle-node__text">
                  <span className="cycle-node__when">{here ? "You are here" : s.when}</span>
                  <strong>{s.label}</strong>
                  <span className="cycle-node__who">{s.who}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="cycle__hub">
        <span className="cycle__hub-icon">
          <Compass size={26} aria-hidden="true" />
        </span>
        <p className="kicker">Your plan grows with you</p>
        <h3>Not sure which fits?</h3>
        <p>Answer a few questions and we suggest the right documents for where you are now.</p>
        <Link href="/plan-finder" className="button">Start the plan finder</Link>
      </div>
    </div>
  );
}
