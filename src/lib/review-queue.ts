import fs from "node:fs";
import path from "node:path";
import { LAUNCH_STATE, servedStates } from "@/config/firm";
import { getComparisons, getGuides, getLifeEvents, getPosts } from "@/lib/content";
import { getAllArticles, getStateGuides } from "@/lib/library";

/**
 * The attorney's review queue. Nothing is indexable in production until the attorney approves it
 * (REQUIRE_ATTORNEY_REVIEW), so review order decides what can rank first. Pages are ordered by search value:
 * pages that target queries a new site can win (research/serp-analysis.md "winnable now"), then launch-state
 * guides, then the 6-12 month targets, then everything else.
 *
 * Each page also gets a risk tier, so the attorney can approve low-risk pages in quick batches and read
 * advice-heavy pages line by line:
 *   low    neutral definitions and plain facts (a wrong answer is unlikely to cost anyone money)
 *   medium general process: how something usually works, with state variation flagged
 *   high   money, tax, Medicaid, disputes, capacity, state statutes and anything close to advice
 * The tier is a suggestion for how to batch the work, never an approval. Only the attorney changes `review`.
 */

export type RiskTier = "low" | "medium" | "high";

export interface ReviewItem {
  path: string;
  title: string;
  kind: "pillar" | "article" | "state" | "guide" | "post" | "comparison" | "life-event";
  reviewed: boolean;
  words: number;
  score: number;
  tier: RiskTier;
  reasons: string[];
}

/** Queries a new site can rank for in months, not years (serp-analysis.md, "Winnable now"). */
const WINNABLE_NOW: [RegExp, string][] = [
  [/cost|fees?\b|price|how-much/, "cost question (winnable now)"],
  [/fund(ing)?-(your-)?(living-)?trust|unfunded-trust|trust-funding/, "trust funding (winnable now)"],
  [/set-up-a-trust|create-a-trust|how-to-make-a-will|how-to-make-a-valid-will/, "how-to setup (winnable now)"],
  [/handwritten|holographic|diy-wills?/, "handwritten wills (winnable now)"],
  [/checklist/, "checklist (winnable now)"],
  [/intestate|without-a-will|no-will/, "intestacy (winnable now)"],
  [/house-in(to)?-a?-?trust|deed|transfer-on-death/, "house and deeds (winnable now)"],
  [/living-will|healthcare-power/, "healthcare POA vs living will (winnable now)"],
  [/own-executor|executor-also|co-executor/, "executor and trustee roles (winnable now)"],
  [/blended|stepchild/, "blended families (winnable now)"],
  [/digital/, "digital assets (winnable now)"],
];

/** Worth winning once the site has links and depth (6-12 months). */
const LATER: [RegExp, string][] = [
  [/will-vs-trust|do-i-need/, "will vs trust (6-12 months)"],
  [/avoid-probate|how-long-does-probate|probate-take/, "probate timing (6-12 months)"],
  [/executor-duties|trustee-duties|successor-trustee|settling-an-estate/, "executor duties (6-12 months)"],
  [/medicaid|look-?back|nursing-home/, "Medicaid (6-12 months)"],
  [/special-needs|able-account/, "special needs (6-12 months)"],
  [/guardian|contest/, "guardianship and contests (6-12 months)"],
];

const HIGH_RISK = /medicaid|look-?back|nursing|tax|gift|irrevocable|asset-protection|contest|dispute|capacity|dementia|incapacit|special-needs|creditor|debt|divorce|elective|spousal|business|buy-sell|crypto|cost|fees?\b|price/;
const HIGH_RISK_CLUSTERS = new Set(["elder-care", "special-needs", "estate-tax", "business-owners", "blended-families"]);
const LOW_RISK = /^what-is-|-explained$|-meaning$|-definition$|glossary|-vs-/;

function tierFor(slug: string, cluster: string | null, kind: ReviewItem["kind"]): RiskTier {
  if (kind === "state") return "high"; // statutory facts, each one must be checked against the code
  if (HIGH_RISK.test(slug) || (cluster && HIGH_RISK_CLUSTERS.has(cluster))) return "high";
  if (LOW_RISK.test(slug) || cluster === "basics") return "low";
  return "medium";
}

function scoreFor(slug: string, kind: ReviewItem["kind"], words: number, extra: { launchState?: boolean } = {}) {
  const reasons: string[] = [];
  let score = { pillar: 40, article: 30, state: 20, guide: 25, comparison: 25, post: 15, "life-event": 15 }[kind];
  const now = WINNABLE_NOW.find(([re]) => re.test(slug));
  if (now) {
    score += 50;
    reasons.push(now[1]);
  }
  const later = !now && LATER.find(([re]) => re.test(slug));
  if (later) {
    score += 25;
    reasons.push(later[1]);
  }
  if (extra.launchState) {
    score += 60;
    reasons.push(`launch state (${LAUNCH_STATE.name})`);
  }
  if (kind === "pillar") reasons.push("topic hub that links every article in its cluster");
  if (words < 600) score -= 10;
  return { score, reasons };
}

/** Pangram scores from scripts/ai-text-check.mjs, keyed by content file. Empty until a key is configured. */
function aiScores(): Record<string, { fraction_ai: number }> {
  const f = path.join(process.cwd(), "content", "ai-text-scores.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
}
const AI_REWRITE = Number(process.env.PANGRAM_MAX_AI ?? 0.5);

/** Content file for a page path, to match AI-text scores. */
function fileFor(p: string): string {
  const m = /^\/learn\/([^/]+)(?:\/([^/]+))?$/.exec(p);
  if (m) return `content/learn/${m[1]}/${m[2] ?? "index"}.md`;
  const s = /^\/estate-planning\/([^/]+)$/.exec(p);
  if (s) return `content/states/${s[1]}.md`;
  return `content${p.replace(/^\/life-events/, "/life-events")}.md`;
}

/** Every page that needs the attorney's sign-off, highest search value first. */
export function reviewQueue({ includeReviewed = false } = {}): ReviewItem[] {
  const served = new Set([...servedStates(), LAUNCH_STATE.abbr]);
  const items: ReviewItem[] = [];
  for (const a of getAllArticles()) {
    const kind = a.kind;
    const key = `${a.cluster}/${a.slug}`;
    items.push({
      path: a.url,
      title: a.title,
      kind,
      reviewed: a.review === "approved",
      words: a.wordCount,
      tier: tierFor(kind === "pillar" ? a.cluster : a.slug, a.cluster, kind),
      ...scoreFor(key, kind, a.wordCount, { launchState: a.cluster === LAUNCH_STATE.slug }),
    });
  }
  for (const s of getStateGuides()) {
    const launchState = served.has(s.abbr);
    items.push({
      path: s.url,
      title: s.title,
      kind: "state",
      reviewed: s.review === "approved",
      words: s.wordCount,
      tier: "high",
      ...scoreFor(s.slug, "state", s.wordCount, { launchState }),
    });
  }
  const add = (base: string, kind: ReviewItem["kind"], docs: { slug: string; title: string; reviewed: boolean; words: number }[]) => {
    for (const d of docs) {
      const words = d.words;
      items.push({ path: `${base}/${d.slug}`, title: d.title, kind, reviewed: d.reviewed, words, tier: tierFor(d.slug, null, kind), ...scoreFor(d.slug, kind, words) });
    }
  };
  add("/guides", "guide", getGuides());
  add("/compare", "comparison", getComparisons());
  add("/blog", "post", getPosts());
  add("/life-events", "life-event", getLifeEvents());
  const scores = aiScores();
  for (const i of items) {
    const ai = scores[fileFor(i.path)]?.fraction_ai;
    if (ai !== undefined && ai > AI_REWRITE) i.reasons.push(`reads ${Math.round(ai * 100)}% AI-written: needs a rewrite in the attorney's words`);
  }
  return items
    .filter((i) => includeReviewed || !i.reviewed)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

/** Pages grouped for batch review: the low-risk batch the attorney can clear quickly, and the rest. */
export function reviewBatches(limit = 25) {
  const queue = reviewQueue();
  const by = (t: RiskTier) => queue.filter((i) => i.tier === t);
  return {
    total: queue.length,
    low: by("low").slice(0, limit),
    medium: by("medium").slice(0, limit),
    high: by("high").slice(0, limit),
    counts: { low: by("low").length, medium: by("medium").length, high: by("high").length },
  };
}
