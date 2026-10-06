import { getComparisons, getGuides, getLifeEvents, getPosts } from "@/lib/content";
import { getClusterArticles, getPillar } from "@/lib/library";

/**
 * Cross-links between the topic-cluster library (/learn) and the site's other collections
 * (/guides, /compare, /blog, /life-events), so both sets reinforce each other instead of competing.
 * Keys are library cluster slugs; values are paths in the other collections.
 */
const BY_CLUSTER: Record<string, string[]> = {
  basics: ["/guides/what-is-estate-planning", "/guides/updating-your-estate-plan", "/compare/online-will-vs-estate-attorney", "/blog/how-to-talk-to-your-parents-about-their-estate-plan"],
  wills: ["/guides/how-to-make-a-will", "/guides/what-makes-a-will-valid", "/guides/what-happens-if-you-die-without-a-will", "/guides/choosing-an-executor", "/compare/will-vs-trust", "/compare/pour-over-will-vs-simple-will", "/blog/should-you-name-co-executors-in-your-will", "/blog/what-is-a-pour-over-will-and-why-do-trusts-have-one", "/blog/does-a-spouse-inherit-everything-if-there-is-no-will", "/blog/can-an-executor-also-be-a-beneficiary"],
  trusts: ["/guides/revocable-living-trust-explained", "/guides/irrevocable-trusts-explained", "/guides/funding-your-trust", "/guides/choosing-a-trustee", "/compare/revocable-vs-irrevocable-trust", "/compare/will-vs-trust", "/compare/joint-ownership-vs-trust", "/blog/should-i-put-my-house-in-a-trust", "/blog/can-a-beneficiary-also-be-the-trustee", "/blog/what-does-a-trustee-actually-do-each-year"],
  probate: ["/guides/how-probate-works", "/compare/probate-vs-non-probate-assets", "/blog/how-long-does-probate-take", "/blog/can-you-skip-probate-for-a-small-estate", "/blog/do-retirement-accounts-go-through-probate", "/blog/what-happens-to-debt-when-someone-dies"],
  "after-a-death": ["/guides/settling-an-estate-step-by-step", "/life-events/death-of-a-parent", "/compare/executor-vs-trustee", "/blog/what-to-do-with-a-parents-bank-account-after-death", "/blog/what-happens-to-a-mortgage-when-the-owner-dies", "/blog/who-gets-the-house-if-theres-no-will-and-no-spouse"],
  "power-of-attorney": ["/guides/powers-of-attorney", "/compare/power-of-attorney-vs-guardianship", "/blog/can-a-power-of-attorney-change-a-will", "/blog/what-happens-to-a-power-of-attorney-when-you-die"],
  "healthcare-directives": ["/guides/healthcare-directives-and-living-wills", "/compare/living-will-vs-healthcare-power-of-attorney", "/blog/what-is-a-hipaa-release-and-why-does-it-belong-in-your-plan", "/blog/who-makes-medical-decisions-if-you-have-no-healthcare-directive", "/life-events/serious-diagnosis"],
  guardianship: ["/guides/guardianship-for-minor-children", "/guides/leaving-money-to-minors", "/blog/can-i-name-my-sister-as-guardian-if-my-husband-disagrees", "/blog/can-you-name-a-guardian-who-lives-in-another-state", "/life-events/new-baby"],
  "life-stages": ["/life-events/new-baby", "/life-events/getting-married", "/life-events/divorce", "/life-events/retirement", "/life-events/buying-a-home", "/life-events/moving-to-a-new-state", "/blog/estate-planning-for-unmarried-couples", "/blog/estate-planning-for-people-with-no-children"],
  "blended-families": ["/guides/estate-planning-for-blended-families", "/life-events/getting-married", "/life-events/divorce"],
  "beneficiary-designations": ["/guides/beneficiary-designations", "/guides/transfer-on-death-and-payable-on-death", "/compare/beneficiary-designation-vs-will", "/compare/transfer-on-death-deed-vs-trust", "/blog/what-happens-if-a-beneficiary-dies-before-you", "/blog/do-retirement-accounts-go-through-probate"],
  "estate-tax": ["/guides/estate-and-inheritance-taxes"],
  "business-owners": ["/guides/business-succession-planning", "/life-events/starting-a-business"],
  "special-needs": ["/guides/special-needs-trusts", "/compare/special-needs-trust-vs-able-account"],
  "elder-care": ["/guides/medicaid-and-long-term-care-planning", "/life-events/caring-for-aging-parents", "/blog/how-to-talk-to-your-parents-about-their-estate-plan"],
  "digital-assets": ["/guides/digital-assets-estate-planning"],
  "property-and-assets": ["/blog/should-i-put-my-house-in-a-trust", "/compare/transfer-on-death-deed-vs-trust", "/compare/joint-ownership-vs-trust", "/life-events/buying-a-home"],
};

export interface SiteLink {
  url: string;
  title: string;
  kind: string;
}

let index: Map<string, SiteLink> | null = null;
function lookup(): Map<string, SiteLink> {
  if (!index) {
    index = new Map();
    for (const g of getGuides()) index.set(`/guides/${g.slug}`, { url: `/guides/${g.slug}`, title: g.title, kind: "Guide" });
    for (const c of getComparisons()) index.set(`/compare/${c.slug}`, { url: `/compare/${c.slug}`, title: c.title, kind: "Comparison" });
    for (const p of getPosts()) index.set(`/blog/${p.slug}`, { url: `/blog/${p.slug}`, title: p.title, kind: "Question" });
    for (const l of getLifeEvents()) index.set(`/life-events/${l.slug}`, { url: `/life-events/${l.slug}`, title: l.title, kind: "Life event" });
  }
  return index;
}

/** Pages elsewhere on the site about a library cluster. Unknown paths are skipped. */
export function siteLinksFor(cluster: string): SiteLink[] {
  const map = lookup();
  return (BY_CLUSTER[cluster] ?? []).map((u) => map.get(u)).filter((x): x is SiteLink => x !== undefined);
}

export function clusterMapPaths(): string[] {
  return Object.values(BY_CLUSTER).flat();
}

/** The reverse direction: library pillars and articles for a page in another collection. */
export function libraryLinksFor(path: string, limit = 4): { href: string; title: string; kind: string }[] {
  const out: { href: string; title: string; kind: string }[] = [];
  for (const [cluster, paths] of Object.entries(BY_CLUSTER)) {
    if (!paths.includes(path)) continue;
    const pillar = getPillar(cluster);
    if (pillar) out.push({ href: pillar.url, title: pillar.title, kind: "Library" });
    for (const a of getClusterArticles(cluster).slice(0, 2)) out.push({ href: a.url, title: a.title, kind: "Library" });
  }
  const seen = new Set<string>();
  return out.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true))).slice(0, limit);
}
