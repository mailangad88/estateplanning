import type { Metadata } from "next";
import Link from "next/link";
import { SITE_DISCLAIMER } from "@/config/firm";
import { SOCIAL_TIPS, type SocialTip } from "@/config/social-tips";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/ui";
import TipBookButton from "@/components/tips/TipBookButton";
import "./tips.css";

export const metadata: Metadata = {
  title: "Quick answers to Illinois estate planning worries",
  description: "Straight answers to the questions families ask most: the house after a death, frozen accounts, dementia, Medicaid, guardians for kids, and the Illinois estate tax.",
  alternates: { canonical: "/tips" },
  robots: SOCIAL_TIPS.some((t) => t.reviewed) ? undefined : { index: false, follow: true },
};

const GROUPS: { title: string; audiences: SocialTip["audience"][] }[] = [
  { title: "After a death", audiences: ["heirs", "widowed"] },
  { title: "Caring for a parent", audiences: ["caregivers"] },
  { title: "Protecting your family", audiences: ["parents", "blended", "couples", "everyone", "homeowners"] },
];

/** Link-in-bio hub for Instagram, Facebook and YouTube. */
export default function TipsHub() {
  return (
    <>
      <PageHero
        crumbs={<Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Quick answers" }]} />}
        kicker="From our videos"
        path="/tips"
        title="Quick answers for Illinois families"
        lead="Saw one of our videos? Here is the full answer, a quick check you can tap through, and what to do this week."
      >
        <TipBookButton slug="hub" topic="other" className="button" />
      </PageHero>
      {GROUPS.map((g) => (
        <section key={g.title} className="tip-hub-group">
          <h2>{g.title}</h2>
          <ul className="tip-grid">
            {SOCIAL_TIPS.filter((t) => g.audiences.includes(t.audience)).map((t) => (
              <li key={t.slug}>
                <Link href={`/tips/${t.slug}`}>
                  <strong>{t.label}</strong>
                  <span>{t.hook}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="notice">{SITE_DISCLAIMER} Attorney advertising.</p>
    </>
  );
}
