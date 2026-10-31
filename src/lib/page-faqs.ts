/**
 * FAQs and a topic diagram for pages that have none of their own (glossary terms, tools, free
 * resources, quizzes, videos, checklists, hubs). Every answer is reused from a page the site already
 * publishes: the library articles' FAQ blocks and the site FAQ (content/faq.json), so the wording
 * goes through the same attorney review as its source page. Nothing is written here.
 *
 * Matching is by shared words between the page's topic and each question, so a page about funding a
 * trust gets questions about funding a trust. New Jersey answers are left out while NJ is not served.
 */
import { getAllArticles } from "@/lib/library";
import { getFaqs, type Faq } from "@/lib/content";
import { servedStates } from "@/config/firm";
import { diagramRegistry, type DiagramEntry } from "@/components/visuals/diagrams/registry";

export interface FaqTopic {
  /** The page's own URL. FAQs from this page are skipped (it shows them already). */
  url?: string;
  /** The page's subject in a few words ("per stirpes", "probate cost"). A question must share these. */
  topic: string;
  /** More words about the page (related guide paths, tags) that rank matching questions higher. */
  context?: string;
  /** Library clusters that fit (e.g. "trusts"), which break ties in their favour. */
  clusters?: string[];
  /** Site FAQ categories to fall back to ("Getting started", "Working with us"...). */
  categories?: string[];
  limit?: number;
}

const STOP = new Set([
  "what", "with", "your", "that", "this", "from", "have", "will", "when", "does", "into", "about", "estate", "planning",
  "plan", "learn", "guides", "free", "tool", "tools", "quiz", "check", "checklist", "video", "need", "should", "there",
  "their", "they", "them", "than", "then", "what's", "which", "while", "after", "before", "more", "most", "much", "many",
  "make", "made", "who", "how", "can", "you", "the", "and", "for", "are", "out", "our", "page", "pages", "know", "work",
  "works", "illinois", "state", "states", "each", "every", "some", "other", "just", "only", "like", "also", "day",
  "take", "own", "get", "use", "put", "do", "does", "doe", "list", "your", "yourself", "it", "actually", "together",
]);

const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");
export const topicWords = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .map(stem),
  );

type Pooled = Faq & { url: string; cluster: string; category?: string; words: Set<string> };

let pool: Pooled[] | null = null;
function faqPool(): Pooled[] {
  if (pool) return pool;
  const nj = servedStates().includes("NJ");
  const out: Pooled[] = [];
  const seen = new Set<string>();
  const add = (f: Faq, url: string, cluster: string, category?: string) => {
    const key = f.q.trim().toLowerCase();
    if (seen.has(key)) return;
    if (!nj && /new jersey|\bN\.?J\.?\b/i.test(`${f.q} ${f.a}`)) return;
    if (/\[[A-Z][^\]]*\]/.test(f.a)) return; // never reuse an answer that still has a placeholder
    seen.add(key);
    out.push({ ...f, url, cluster, category, words: topicWords(f.q) });
  };
  for (const f of getFaqs()) add(f, "/faq", "site", f.category);
  for (const a of getAllArticles()) {
    if (!nj && a.cluster === "new-jersey") continue;
    for (const f of a.faqs) add(f, a.url, a.cluster);
  }
  pool = out;
  return pool;
}

/**
 * Up to `limit` questions that fit the topic, best first, each from a different source page where
 * possible. Falls back to the site FAQ's categories when the topic matches too little.
 */
export function faqsFor({ url, topic, context = "", clusters = [], categories = [], limit = 4 }: FaqTopic): Faq[] {
  const want = topicWords(topic);
  const extra = topicWords(context);
  const rank = (need: number, min: number) =>
    faqPool()
      .filter((f) => f.url !== url)
      .map((f) => {
        let hits = 0;
        let more = 0;
        for (const w of f.words) {
          if (want.has(w)) hits++;
          else if (extra.has(w)) more++;
        }
        if (!need || hits < need) return { f, score: 0 };
        let score = hits * 2 + more;
        if (clusters.includes(f.cluster)) score += 0.5;
        if (f.url === "/faq") score += 0.25;
        return { f, score };
      })
      .filter((x) => x.score >= min)
      .sort((a, b) => b.score - a.score || a.f.q.length - b.f.q.length);

  const picked: Pooled[] = [];
  const fromPage = new Map<string, number>();
  const take = (list: { f: Pooled }[]) => {
    for (const { f } of list) {
      if (picked.length >= limit) break;
      if (picked.includes(f) || (fromPage.get(f.url) ?? 0) >= 2) continue;
      if (picked.some((p) => overlapRatio(p.words, f.words) > 0.6)) continue;
      picked.push(f);
      fromPage.set(f.url, (fromPage.get(f.url) ?? 0) + 1);
    }
  };
  const need = Math.min(2, want.size);
  take(rank(need, 1));
  // Two-word topics: also take questions that share one topic word and at least one context word.
  if (picked.length < 3 && need === 2) take(rank(1, 4));
  if (picked.length < Math.min(3, limit)) {
    take(faqPool().filter((f) => f.url === "/faq" && f.category && categories.includes(f.category)).map((f) => ({ f })));
  }
  return picked.map(({ q, a }) => ({ q, a }));
}

function overlapRatio(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}

/**
 * The diagram that best fits a topic: registry topic slugs found in the text first, then shared words
 * with the diagram title. Returns the fallback (the planning process) when nothing fits.
 */
export function diagramFor(topic: string, opts: { exclude?: string[]; fallback?: string | null } = {}): DiagramEntry | undefined {
  const hay = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const want = topicWords(topic);
  const best = diagramRegistry
    .filter((d) => !opts.exclude?.includes(d.name))
    .map((d) => {
      let score = d.topics.filter((t) => hay.includes(t)).length;
      for (const w of topicWords(d.title)) if (want.has(w)) score += 0.5;
      return { d, score };
    })
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score)[0]?.d;
  if (best) return best;
  const fb = opts.fallback === undefined ? "PlanningProcess" : opts.fallback;
  return fb ? diagramRegistry.find((d) => d.name === fb) : undefined;
}
