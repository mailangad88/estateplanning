import { TOOLS } from "@/config/tools";
import { DECISIONS, decisionPath } from "@/config/decisions";
import { getChecklists, getComparisons, getGuides, getLifeEvents, getPosts } from "@/lib/content";
import { getClusterArticles, getPillar } from "@/lib/library";
import { magnetsFor, type Magnet } from "@/lib/magnets";

/**
 * Cross-links between the topic-cluster library (/learn) and the site's other collections
 * (/guides, /compare, /blog, /life-events), so both sets reinforce each other instead of competing.
 * Keys are library cluster slugs; values are paths in the other collections.
 */
const BY_CLUSTER: Record<string, string[]> = {
  illinois: ["/guides/how-probate-works", "/guides/how-to-make-a-will", "/guides/powers-of-attorney", "/guides/healthcare-directives-and-living-wills", "/guides/funding-your-trust", "/compare/transfer-on-death-deed-vs-trust"],
  basics: ["/compare/online-will-vs-estate-attorney", "/blog/how-to-talk-to-your-parents-about-their-estate-plan"],
  wills: ["/guides/how-to-make-a-will", "/guides/what-makes-a-will-valid", "/compare/pour-over-will-vs-simple-will", "/blog/should-you-name-co-executors-in-your-will", "/blog/what-is-a-pour-over-will-and-why-do-trusts-have-one", "/blog/does-a-spouse-inherit-everything-if-there-is-no-will", "/blog/can-an-executor-also-be-a-beneficiary"],
  trusts: ["/guides/irrevocable-trusts-explained", "/guides/funding-your-trust", "/compare/revocable-vs-irrevocable-trust", "/compare/joint-ownership-vs-trust", "/blog/should-i-put-my-house-in-a-trust", "/blog/can-a-beneficiary-also-be-the-trustee", "/blog/what-does-a-trustee-actually-do-each-year"],
  probate: ["/guides/how-probate-works", "/blog/can-you-skip-probate-for-a-small-estate", "/blog/do-retirement-accounts-go-through-probate"],
  "after-a-death": ["/guides/settling-an-estate-step-by-step", "/life-events/death-of-a-parent", "/compare/executor-vs-trustee", "/blog/what-to-do-with-a-parents-bank-account-after-death", "/blog/what-happens-to-a-mortgage-when-the-owner-dies", "/blog/who-gets-the-house-if-theres-no-will-and-no-spouse"],
  "power-of-attorney": ["/guides/powers-of-attorney", "/blog/can-a-power-of-attorney-change-a-will", "/blog/what-happens-to-a-power-of-attorney-when-you-die"],
  "healthcare-directives": ["/guides/healthcare-directives-and-living-wills", "/compare/living-will-vs-healthcare-power-of-attorney", "/blog/what-is-a-hipaa-release-and-why-does-it-belong-in-your-plan", "/blog/who-makes-medical-decisions-if-you-have-no-healthcare-directive", "/life-events/serious-diagnosis"],
  guardianship: ["/guides/guardianship-for-minor-children", "/blog/can-i-name-my-sister-as-guardian-if-my-husband-disagrees", "/blog/can-you-name-a-guardian-who-lives-in-another-state", "/life-events/new-baby"],
  "life-stages": ["/life-events/new-baby", "/life-events/getting-married", "/life-events/divorce", "/life-events/retirement", "/life-events/buying-a-home", "/life-events/moving-to-a-new-state", "/blog/estate-planning-for-people-with-no-children"],
  "blended-families": ["/guides/estate-planning-for-blended-families", "/life-events/getting-married", "/life-events/divorce"],
  "beneficiary-designations": ["/guides/beneficiary-designations", "/compare/beneficiary-designation-vs-will", "/compare/transfer-on-death-deed-vs-trust", "/blog/what-happens-if-a-beneficiary-dies-before-you", "/blog/do-retirement-accounts-go-through-probate"],
  "estate-tax": ["/guides/estate-and-inheritance-taxes"],
  "business-owners": ["/life-events/starting-a-business"],
  "special-needs": ["/guides/special-needs-trusts", "/compare/special-needs-trust-vs-able-account"],
  "elder-care": ["/life-events/caring-for-aging-parents", "/blog/how-to-talk-to-your-parents-about-their-estate-plan"],
  "digital-assets": [],
  "what-if": ["/blog/what-happens-if-a-beneficiary-dies-before-you", "/blog/who-gets-the-house-if-theres-no-will-and-no-spouse", "/blog/who-makes-medical-decisions-if-you-have-no-healthcare-directive", "/blog/does-a-spouse-inherit-everything-if-there-is-no-will"],
  "property-and-assets": ["/blog/should-i-put-my-house-in-a-trust", "/compare/transfer-on-death-deed-vs-trust", "/compare/joint-ownership-vs-trust", "/life-events/buying-a-home"],
};

/** Free tools and printable checklists for each cluster: the lead capture points for library readers. */
const TOOLS_BY_CLUSTER: Record<string, string[]> = {
  illinois: ["/tools/small-estate-checker", "/tools/probate-cost-estimator", "/decide/ways-to-avoid-probate", "/tools/will-or-trust", "/checklists/first-30-days-after-a-death"],
  basics: ["/tools/plan-readiness-assessment", "/checklists/documents-to-gather-before-your-consult", "/checklists/asset-and-account-inventory", "/checklists/letter-of-instruction-outline"],
  wills: ["/decide/per-stirpes-vs-per-capita", "/tools/who-inherits", "/tools/will-or-trust", "/checklists/choosing-an-executor-worksheet", "/tools/plan-readiness-assessment"],
  trusts: ["/decide/types-of-trusts", "/tools/will-or-trust", "/checklists/trust-funding-checklist", "/tools/probate-cost-estimator"],
  probate: ["/decide/ways-to-avoid-probate", "/decide/types-of-probate", "/tools/probate-asset-sorter", "/tools/inheritance-timeline", "/tools/small-estate-checker", "/tools/probate-cost-estimator", "/tools/executor-workload", "/checklists/first-30-days-after-a-death"],
  "after-a-death": ["/decide/types-of-probate", "/checklists/first-30-days-after-a-death", "/tools/inheritance-timeline", "/tools/who-inherits", "/tools/small-estate-checker", "/tools/executor-workload", "/tools/probate-cost-estimator"],
  "power-of-attorney": ["/decide/types-of-power-of-attorney", "/decide/how-to-manage-a-parents-finances", "/tools/plan-readiness-assessment", "/checklists/important-contacts-list"],
  "healthcare-directives": ["/decide/types-of-advance-directives", "/checklists/funeral-and-burial-wishes", "/tools/plan-readiness-assessment"],
  guardianship: ["/decide/leaving-money-to-minor-children", "/decide/alternatives-to-guardianship", "/tools/guardian-picker", "/checklists/choosing-a-guardian-worksheet", "/tools/guardian-fund-calculator", "/tools/life-insurance-needs"],
  "life-stages": ["/tools/plan-review-reminder", "/tools/plan-readiness-assessment", "/checklists/annual-estate-plan-review"],
  "blended-families": ["/decide/estate-planning-for-second-marriages", "/tools/beneficiary-audit", "/checklists/beneficiary-designation-audit", "/tools/plan-review-reminder"],
  "beneficiary-designations": ["/decide/per-stirpes-vs-per-capita", "/tools/beneficiary-audit", "/checklists/beneficiary-designation-audit", "/checklists/asset-and-account-inventory"],
  "estate-tax": ["/decide/types-of-trusts", "/tools/state-death-tax-checker", "/tools/estate-tax-estimator", "/checklists/asset-and-account-inventory"],
  "business-owners": ["/decide/llc-vs-trust-for-rental-property", "/tools/life-insurance-needs", "/checklists/important-contacts-list", "/tools/plan-readiness-assessment"],
  "special-needs": ["/decide/types-of-special-needs-trusts", "/decide/alternatives-to-guardianship", "/tools/guardian-fund-calculator", "/checklists/letter-of-instruction-outline"],
  "elder-care": ["/decide/guardianship-vs-conservatorship", "/decide/how-to-manage-a-parents-finances", "/tools/medicaid-savings-runway", "/tools/medicaid-lookback-date", "/checklists/documents-to-gather-before-your-consult"],
  "digital-assets": ["/checklists/digital-assets-inventory", "/checklists/important-contacts-list"],
  "what-if": ["/tools/who-inherits", "/tools/plan-readiness-assessment", "/tools/beneficiary-audit", "/checklists/annual-estate-plan-review", "/tools/plan-review-reminder"],
  "property-and-assets": ["/decide/how-to-leave-your-house-to-your-children", "/tools/probate-asset-sorter", "/decide/ways-to-hold-title-to-property", "/decide/llc-vs-trust-for-rental-property", "/checklists/trust-funding-checklist", "/tools/will-or-trust", "/tools/probate-cost-estimator"],
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
    for (const t of TOOLS) index.set(`/tools/${t.slug}`, { url: `/tools/${t.slug}`, title: t.title, kind: "Free tool" });
    for (const c of getChecklists()) index.set(`/checklists/${c.slug}`, { url: `/checklists/${c.slug}`, title: c.title, kind: "Printable checklist" });
    for (const d of DECISIONS) index.set(decisionPath(d.slug), { url: decisionPath(d.slug), title: d.h1, kind: "Decision guide" });
  }
  return index;
}

/** Pages elsewhere on the site about a library cluster. Unknown paths are skipped. */
export function siteLinksFor(cluster: string): SiteLink[] {
  const map = lookup();
  return (BY_CLUSTER[cluster] ?? []).map((u) => map.get(u)).filter((x): x is SiteLink => x !== undefined);
}

/** Free tools and checklists for a cluster. */
export function toolsFor(cluster: string): SiteLink[] {
  const map = lookup();
  return (TOOLS_BY_CLUSTER[cluster] ?? []).map((u) => map.get(u)).filter((x): x is SiteLink => x !== undefined);
}

export function clusterMapPaths(): string[] {
  return [...Object.values(BY_CLUSTER).flat(), ...Object.values(TOOLS_BY_CLUSTER).flat()];
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

/**
 * Library clusters and articles about grief, health or disability. They get the same treatment as the
 * site's sensitive audience pages (backlog B10): no ad pixels and no email opt-in form, only plain links.
 */
const SENSITIVE_CLUSTERS = new Set(["after-a-death", "special-needs", "elder-care"]);
const SENSITIVE_SLUG = /diagnosis|dementia|lgbtq|same-sex|terminal|grief/;

export function isSensitiveLibraryPage(cluster: string, slug = ""): boolean {
  return SENSITIVE_CLUSTERS.has(cluster) || SENSITIVE_SLUG.test(slug);
}

/**
 * Free resources (/free/<slug>) for a library page: ones that list the page itself in `related`, then
 * ones attached to the matching guides, life events and comparisons for its cluster.
 */
export function magnetsForLibrary(url: string, cluster: string, limit = 3): Magnet[] {
  const out: Magnet[] = [];
  const seen = new Set<string>();
  for (const path of [url, ...(BY_CLUSTER[cluster] ?? [])]) {
    for (const m of magnetsFor(path)) {
      if (seen.has(m.slug)) continue;
      seen.add(m.slug);
      out.push(m);
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
