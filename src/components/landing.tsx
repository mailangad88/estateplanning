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

export function StageCard({ stage }: { stage: LifeStage }) {
  const Icon = ICONS[stage.icon] ?? Heart;
  return (
    <Link href={`/estate-planning-for/${stage.slug}`} className={`stage-card stage-card--${stage.tone}`}>
      <span className="stage-card__icon">
        <Icon size={24} aria-hidden="true" />
      </span>
      <strong>{stage.label}</strong>
      <span className="stage-card__who">{stage.who}</span>
      <span className="stage-card__go">
        See your plan <ArrowRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}

export function StageGrid({ exclude }: { exclude?: string }) {
  return (
    <ul className="stage-grid">
      {LIFE_STAGES.filter((s) => s.slug !== exclude).map((s) => (
        <li key={s.slug}>
          <StageCard stage={s} />
        </li>
      ))}
      <li>
        <Link href="/plan-finder" className="stage-card stage-card--finder">
          <span className="stage-card__icon">
            <Compass size={24} aria-hidden="true" />
          </span>
          <strong>Not sure which fits?</strong>
          <span className="stage-card__who">Answer a few questions and we suggest the right documents.</span>
          <span className="stage-card__go">
            Start the plan finder <ArrowRight size={16} aria-hidden="true" />
          </span>
        </Link>
      </li>
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
