/**
 * Search and AI visibility tracker: for each money keyword or question in content/visibility-queries.json,
 * is familyfutureplanning.com ranked, cited or mentioned by Google, Bing, Google AI Overviews / AI Mode,
 * ChatGPT, Perplexity, Gemini, Claude and Brave? Pure logic lives here (engine registry, cost estimates,
 * budget, citation matching, response parsing, suggestions, report). Network calls live in
 * scripts/seo/visibility.mts. See docs/ai-visibility.md.
 *
 * Every paid call goes through the same three guards as the DataForSEO CLI (PR #64): a cache, a per-run
 * cap (VISIBILITY_MAX_SPEND_USD) and a monthly cap (VISIBILITY_MONTHLY_CAP_USD) read from a spend ledger.
 * Costs are upper-bound estimates; the ledger records the estimate, not the bill.
 */
import { createHash } from "node:crypto";

export type Env = Record<string, string | undefined>;

export type EngineKey =
  | "gsc"
  | "bing_webmaster"
  | "google_serp"
  | "google_ai_mode"
  | "bing_serp"
  | "chatgpt"
  | "perplexity"
  | "gemini"
  | "claude"
  | "brave";

export interface EngineSpec {
  label: string;
  /** "metrics" engines report impressions/clicks for our own site; "answer" engines are asked each query. */
  kind: "metrics" | "serp" | "answer";
  /** Env vars that must all be set for the engine to run. */
  env: string[];
  /** Upper-bound cost per query (answer/serp) or per run (metrics), USD. */
  estUsd: number;
  /** Hosts the network policy must allow. */
  hosts: string[];
  what: string;
}

export const ENGINES: Record<EngineKey, EngineSpec> = {
  gsc: {
    label: "Google Search Console",
    kind: "metrics",
    env: ["GSC_SERVICE_ACCOUNT_JSON"],
    estUsd: 0,
    hosts: ["oauth2.googleapis.com", "www.googleapis.com"],
    what: "Free. Real Google impressions, clicks and average position for our pages, by query.",
  },
  bing_webmaster: {
    label: "Bing Webmaster Tools",
    kind: "metrics",
    env: ["BING_WEBMASTER_API_KEY"],
    estUsd: 0,
    hosts: ["ssl.bing.com"],
    what: "Free. Real Bing impressions, clicks and position. Bing's index feeds ChatGPT search, Copilot and DuckDuckGo.",
  },
  google_serp: {
    label: "Google results + AI Overview (DataForSEO)",
    kind: "serp",
    env: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
    estUsd: 0.006,
    hosts: ["api.dataforseo.com"],
    what: "Our Google rank in Illinois (top 20) and whether the AI Overview cites us.",
  },
  google_ai_mode: {
    label: "Google AI Mode (DataForSEO)",
    kind: "serp",
    env: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
    estUsd: 0.006,
    hosts: ["api.dataforseo.com"],
    what: "Which sites Google's AI Mode answer links to.",
  },
  bing_serp: {
    label: "Bing results (DataForSEO)",
    kind: "serp",
    env: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
    estUsd: 0.004,
    hosts: ["api.dataforseo.com"],
    what: "Our Bing rank (top 20). Proxy for ChatGPT search and Copilot, which read Bing.",
  },
  chatgpt: {
    label: "ChatGPT (OpenAI API + web search)",
    kind: "answer",
    env: ["OPENAI_API_KEY"],
    estUsd: 0.03,
    hosts: ["api.openai.com"],
    what: "Asks the question with web search on, records the sources the answer cites.",
  },
  perplexity: {
    label: "Perplexity (Sonar API)",
    kind: "answer",
    env: ["PERPLEXITY_API_KEY"],
    estUsd: 0.008,
    hosts: ["api.perplexity.ai"],
    what: "Asks Sonar the question, records its citations.",
  },
  gemini: {
    label: "Gemini (Google Search grounding)",
    kind: "answer",
    env: ["GEMINI_API_KEY"],
    estUsd: 0.035,
    hosts: ["generativelanguage.googleapis.com"],
    what: "Asks Gemini with Google Search grounding, records grounding sources. Free tier covers a few hundred grounded calls a day.",
  },
  claude: {
    label: "Claude (web search tool)",
    kind: "answer",
    env: ["ANTHROPIC_API_KEY"],
    estUsd: 0.025,
    hosts: ["api.anthropic.com"],
    what: "Asks Claude with web search on (max 2 searches), records cited URLs.",
  },
  brave: {
    label: "Brave Search",
    kind: "serp",
    env: ["BRAVE_SEARCH_API_KEY"],
    estUsd: 0.005,
    hosts: ["api.search.brave.com"],
    what: "Our Brave rank (top 20). Brave's index is used by several AI assistants.",
  },
};

export const ENGINE_KEYS = Object.keys(ENGINES) as EngineKey[];

export function engineConfigured(key: EngineKey, env: Env = process.env): boolean {
  return ENGINES[key].env.every((name) => Boolean(env[name]));
}

/** Env name aliases people already use (the cloud env stores the DataForSEO password as DATAFORSEO_PSWD). */
export function normalizeEnv(env: Env): Env {
  const out = { ...env };
  if (!out.DATAFORSEO_PASSWORD && out.DATAFORSEO_PSWD) out.DATAFORSEO_PASSWORD = out.DATAFORSEO_PSWD;
  if (!out.GEMINI_API_KEY && out.GOOGLE_API_KEY) out.GEMINI_API_KEY = out.GOOGLE_API_KEY;
  if (!out.PERPLEXITY_API_KEY && out.PPLX_API_KEY) out.PERPLEXITY_API_KEY = out.PPLX_API_KEY;
  return out;
}

/* ---------- queries ---------- */

export interface VisibilityQuery {
  id: string;
  query: string;
  tier: "core" | "extended";
  intent: string;
  page: string;
}

export function selectQueries(all: VisibilityQuery[], opts: { all?: boolean; ids?: string[]; limit?: number }): VisibilityQuery[] {
  let list = opts.ids?.length ? all.filter((q) => opts.ids!.includes(q.id)) : opts.all ? all : all.filter((q) => q.tier === "core");
  if (opts.limit && opts.limit > 0) list = list.slice(0, opts.limit);
  return list;
}

/* ---------- matching ---------- */

export const BRAND_NAMES = ["Family Future Planning", "familyfutureplanning"];

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url.toLowerCase().replace(/^www\./, "").split("/")[0];
  }
}

export function isOurs(urlOrDomain: string, domain: string): boolean {
  const h = hostOf(urlOrDomain.includes("://") ? urlOrDomain : `https://${urlOrDomain}`);
  return h === domain || h.endsWith(`.${domain}`);
}

export function mentionsBrand(text: string, domain: string): boolean {
  const t = text.toLowerCase();
  return t.includes(domain) || BRAND_NAMES.some((b) => t.includes(b.toLowerCase()));
}

/** A cited source. `domain` matters when the URL is a redirect (Gemini grounding links). */
export interface Source {
  url: string;
  domain?: string;
  title?: string;
}

export interface Observation {
  at: string;
  runId: string;
  engine: EngineKey;
  queryId: string;
  query: string;
  /** Our page appears among cited sources (answer engines) or AI Overview references. */
  cited: boolean;
  /** Our organic position, 1-based, or null when not in the checked depth. Answer engines: position in source list. */
  rank: number | null;
  /** Brand or domain named in the answer text. */
  mentioned: boolean;
  ourUrls: string[];
  /** Other domains cited, in order, deduplicated, up to 10. */
  competitors: string[];
  answer?: string;
  /** Google only: an AI Overview was shown. */
  aiOverview?: boolean;
  cost: number;
  cached?: boolean;
  error?: string;
}

/** Turns a raw source list into the cited / rank / competitors fields. */
export function scoreSources(sources: Source[], domain: string): Pick<Observation, "cited" | "rank" | "ourUrls" | "competitors"> {
  const ourUrls: string[] = [];
  const competitors: string[] = [];
  let rank: number | null = null;
  const seen = new Set<string>();
  sources.forEach((s) => {
    const d = (s.domain ? hostOf(`https://${s.domain.replace(/^https?:\/\//, "")}`) : hostOf(s.url)) || "";
    if (!d) return;
    if (isOurs(d, domain) || isOurs(s.url, domain)) {
      if (rank === null) rank = seen.size + 1;
      if (!ourUrls.includes(s.url)) ourUrls.push(s.url);
      seen.add(domain);
      return;
    }
    if (!seen.has(d)) {
      seen.add(d);
      if (competitors.length < 10) competitors.push(d);
    }
  });
  return { cited: ourUrls.length > 0, rank, ourUrls, competitors };
}

/* ---------- response parsers (one per engine, all tolerant of missing fields) ---------- */

type J = any;

export function parsePerplexity(json: J): { text: string; sources: Source[] } {
  const text = json?.choices?.[0]?.message?.content ?? "";
  const fromResults: Source[] = (json?.search_results ?? []).map((r: J) => ({ url: String(r.url ?? ""), title: r.title }));
  const fromCitations: Source[] = (json?.citations ?? []).map((u: J) => ({ url: String(u) }));
  return { text, sources: fromResults.length ? fromResults : fromCitations };
}

export function parseOpenAI(json: J): { text: string; sources: Source[] } {
  const sources: Source[] = [];
  let text = typeof json?.output_text === "string" ? json.output_text : "";
  const parts: string[] = [];
  for (const item of json?.output ?? []) {
    if (item?.type === "message") {
      for (const c of item.content ?? []) {
        if (c?.type === "output_text") {
          parts.push(c.text ?? "");
          for (const a of c.annotations ?? []) if (a?.type === "url_citation" && a.url) sources.push({ url: a.url, title: a.title });
        }
      }
    }
    if (item?.type === "web_search_call") {
      for (const s of item.action?.sources ?? []) if (s?.url) sources.push({ url: s.url, title: s.title });
    }
  }
  if (!text) text = parts.join("\n");
  return { text, sources };
}

export function parseGemini(json: J): { text: string; sources: Source[] } {
  const cand = json?.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p: J) => p?.text ?? "").join("");
  // Grounding URIs are vertexaisearch redirect links; the title carries the source domain.
  const sources: Source[] = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c: J) => c?.web)
    .filter(Boolean)
    .map((w: J) => ({ url: String(w.uri ?? ""), domain: looksLikeDomain(w.title) ? String(w.title) : undefined, title: w.title }));
  return { text, sources };
}

export function parseClaude(content: J[]): { text: string; sources: Source[] } {
  const sources: Source[] = [];
  const parts: string[] = [];
  for (const b of content ?? []) {
    if (b?.type === "text") {
      parts.push(b.text ?? "");
      for (const c of b.citations ?? []) if (c?.url) sources.push({ url: c.url, title: c.title });
    }
  }
  // Cited sources first; then everything the searches returned, so rank reflects "seen by Claude" too.
  const cited = sources.length;
  for (const b of content ?? []) {
    if (b?.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r?.url) sources.push({ url: r.url, title: r.title });
    }
  }
  return { text: parts.join(""), sources: cited ? sources.slice(0, cited) : sources };
}

export function parseBrave(json: J): { sources: Source[] } {
  return { sources: (json?.web?.results ?? []).map((r: J) => ({ url: String(r.url ?? ""), title: r.title })) };
}

/** DataForSEO SERP: organic items give the rank; ai_overview items (and AI Mode) give references. */
export function parseDataForSeoSerp(json: J): { organic: Source[]; aiRefs: Source[]; aiOverview: boolean; aiText: string } {
  const items: J[] = json?.tasks?.[0]?.result?.[0]?.items ?? [];
  const organic: Source[] = [];
  const aiRefs: Source[] = [];
  let aiOverview = false;
  let aiText = "";
  for (const it of items) {
    if (it?.type === "organic" && it.url) organic.push({ url: it.url, domain: it.domain, title: it.title });
    if (it?.type === "ai_overview") {
      aiOverview = true;
      aiText += collectText(it);
      collectRefs(it, aiRefs);
    }
  }
  return { organic, aiRefs, aiOverview, aiText };
}

function collectRefs(node: J, out: Source[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => collectRefs(n, out));
  if (Array.isArray(node.references)) {
    for (const r of node.references) if (r?.url || r?.domain) out.push({ url: String(r.url ?? `https://${r.domain}`), domain: r.domain, title: r.title });
  }
  for (const [k, v] of Object.entries(node)) if (k !== "references" && v && typeof v === "object") collectRefs(v, out);
}

function collectText(node: J): string {
  if (!node || typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  let s = typeof node.text === "string" ? `${node.text} ` : "";
  for (const [k, v] of Object.entries(node)) if (k !== "text" && v && typeof v === "object") s += collectText(v);
  return s;
}

function looksLikeDomain(s: unknown): boolean {
  return typeof s === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s.trim());
}

/* ---------- metrics engines (Search Console, Bing Webmaster) ---------- */

export interface QueryMetric {
  query: string;
  page?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export function parseGscRows(json: J): QueryMetric[] {
  return (json?.rows ?? []).map((r: J) => ({
    query: String(r.keys?.[0] ?? ""),
    page: r.keys?.[1],
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    ctr: Number(r.ctr) || 0,
    position: Number(r.position) || 0,
  }));
}

/** Bing GetQueryStats returns one row per query per day; sum them. */
export function parseBingQueryStats(json: J): QueryMetric[] {
  const by = new Map<string, QueryMetric & { posWeight: number }>();
  for (const r of json?.d ?? []) {
    const q = String(r.Query ?? "");
    const m = by.get(q) ?? { query: q, clicks: 0, impressions: 0, ctr: 0, position: 0, posWeight: 0 };
    const imp = Number(r.Impressions) || 0;
    m.clicks += Number(r.Clicks) || 0;
    m.impressions += imp;
    m.posWeight += (Number(r.AvgImpressionPosition) || 0) * imp;
    by.set(q, m);
  }
  return [...by.values()].map(({ posWeight, ...m }) => ({
    ...m,
    ctr: m.impressions ? m.clicks / m.impressions : 0,
    position: m.impressions ? Math.round((posWeight / m.impressions) * 10) / 10 : 0,
  }));
}

/** Metrics rows whose query contains every word of the tracked query (cheap fuzzy match). */
export function metricsFor(q: VisibilityQuery, rows: QueryMetric[]): QueryMetric | null {
  const words = q.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  const hits = rows.filter((r) => words.every((w) => r.query.toLowerCase().includes(w)));
  if (!hits.length) return null;
  const imp = hits.reduce((s, r) => s + r.impressions, 0);
  const clicks = hits.reduce((s, r) => s + r.clicks, 0);
  const pos = imp ? hits.reduce((s, r) => s + r.position * r.impressions, 0) / imp : 0;
  return { query: q.query, clicks, impressions: imp, ctr: imp ? clicks / imp : 0, position: Math.round(pos * 10) / 10 };
}
const STOP = new Set(["the", "and", "for", "how", "does", "what", "who", "much", "need", "can", "you", "are", "with", "there"]);

/* ---------- budget, cache, ledger ---------- */

export interface BudgetState {
  runCap: number;
  monthlyCap: number;
  spentThisRun: number;
  spentThisMonth: number;
}

export function budgetFromEnv(spentThisMonth: number, env: Env = process.env): BudgetState {
  return {
    runCap: num(env.VISIBILITY_MAX_SPEND_USD, 3),
    monthlyCap: num(env.VISIBILITY_MONTHLY_CAP_USD, 15),
    spentThisRun: 0,
    spentThisMonth,
  };
}

export function overBudget(state: BudgetState, next: number): string | null {
  if (state.spentThisRun + next > state.runCap)
    return `run cap $${state.runCap.toFixed(2)} reached (spent ~$${state.spentThisRun.toFixed(3)}). Raise VISIBILITY_MAX_SPEND_USD to continue.`;
  if (state.spentThisMonth + next > state.monthlyCap)
    return `monthly cap $${state.monthlyCap.toFixed(2)} reached (spent ~$${state.spentThisMonth.toFixed(3)} this month). Raise VISIBILITY_MONTHLY_CAP_USD to continue.`;
  return null;
}

export function monthSpend(lines: { at: string; cost: number }[], now: Date = new Date()): number {
  const ym = now.toISOString().slice(0, 7);
  return round(lines.filter((l) => l.at?.slice(0, 7) === ym).reduce((s, l) => s + (Number(l.cost) || 0), 0));
}

export function cacheKey(engine: EngineKey, query: string, extra = ""): string {
  return createHash("sha256").update(`${engine}\n${query.trim().toLowerCase()}\n${extra}`).digest("hex").slice(0, 32);
}

/** Planned spend for a run, so --dry-run can show it before anything is called. */
export function planCost(engines: EngineKey[], queryCount: number): { engine: EngineKey; calls: number; usd: number }[] {
  return engines.map((e) => {
    const calls = ENGINES[e].kind === "metrics" ? 1 : queryCount;
    return { engine: e, calls, usd: round(calls * ENGINES[e].estUsd) };
  });
}

/* ---------- suggestions ---------- */

const AI_ENGINES: EngineKey[] = ["chatgpt", "perplexity", "gemini", "claude", "google_ai_mode"];

export function suggestFixes(
  q: VisibilityQuery,
  obs: Observation[],
  metrics: Partial<Record<"gsc" | "bing_webmaster", QueryMetric | null>>,
): string[] {
  const ok = obs.filter((o) => !o.error);
  if (!ok.length) return [];
  const tips: string[] = [];
  const by = (e: EngineKey) => ok.find((o) => o.engine === e);
  const g = by("google_serp");
  const b = by("bing_serp");
  const aiChecked = ok.filter((o) => AI_ENGINES.includes(o.engine));
  const aiCited = aiChecked.filter((o) => o.cited);
  const rivals = topCompetitors(ok, 3);

  if (!ok.some((o) => o.cited || (o.rank !== null && ENGINES[o.engine].kind === "serp"))) {
    tips.push(
      `Not found in any engine. Compare ${q.page} with ${rivals.join(", ") || "the cited pages"}: open with a 40 to 60 word direct answer to "${q.query}", add the specific numbers, deadlines and statute they cite, and make sure the page is indexed (sitemap, IndexNow).`,
    );
  }
  if (g?.rank && g.rank > 3 && g.rank <= 20) {
    tips.push(`Google rank #${g.rank}. Add 3 to 5 internal links to ${q.page} from related Illinois pages using the query wording, and sharpen the title to match "${q.query}".`);
  }
  if (g?.aiOverview && !g.cited) {
    tips.push(`Google shows an AI Overview but does not cite us. Add a short answer box and an FAQ entry that answers "${q.query}" in one or two sentences, with the source named.`);
  }
  if (g?.rank && g.rank <= 10 && (!b || b.rank === null)) {
    tips.push("Ranks on Google but not in Bing's top 20. ChatGPT search and Copilot read Bing: check the page in Bing Webmaster URL Inspection and push it with IndexNow.");
  }
  if (aiChecked.length >= 2 && aiCited.length === 0 && (g?.rank ?? 99) <= 10) {
    tips.push("Ranks in search but no AI assistant cites it. Add a quotable summary, a named reviewing attorney with date, and a table of the key figures; AI answers favour pages with clear, attributable facts.");
  }
  for (const o of aiChecked) {
    if (o.mentioned && !o.cited) tips.push(`${ENGINES[o.engine].label} names us but links elsewhere. Make sure ${q.page} is the canonical answer and is linked from llms.txt.`);
  }
  const gm = metrics.gsc;
  if (gm && gm.impressions >= 100 && gm.ctr < 0.02 && gm.position <= 10) {
    tips.push(`Search Console: ${gm.impressions} impressions at position ${gm.position} but ${(gm.ctr * 100).toFixed(1)}% CTR. Rewrite the title and meta description to promise the exact answer.`);
  }
  if (gm && gm.position > 10 && gm.position <= 20) tips.push(`Search Console: average position ${gm.position}, on page 2. A content refresh and internal links can move it onto page 1.`);
  if (rivals.length) tips.push(`Most cited instead of us: ${rivals.join(", ")}.`);
  return tips;
}

export function topCompetitors(obs: Observation[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const o of obs) for (const d of o.competitors.slice(0, 5)) counts.set(d, (counts.get(d) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([d]) => d);
}

/* ---------- report ---------- */

export function cell(o: Observation | undefined): string {
  if (!o) return "";
  if (o.error) return "error";
  if (ENGINES[o.engine].kind === "serp" && o.engine !== "google_ai_mode") {
    const r = o.rank ? `#${o.rank}` : "-";
    return o.engine === "google_serp" && o.aiOverview ? `${r}${o.cited ? " +AIO" : " (AIO)"}` : r;
  }
  return o.cited ? `cited${o.rank ? ` #${o.rank}` : ""}` : o.mentioned ? "named" : "-";
}

export function renderReport(input: {
  runId: string;
  domain: string;
  engines: EngineKey[];
  queries: VisibilityQuery[];
  obs: Observation[];
  metrics: Partial<Record<"gsc" | "bing_webmaster", QueryMetric[]>>;
  spent: number;
  skipped: string[];
  previous?: Observation[];
}): string {
  const { runId, domain, engines, queries, obs, metrics, spent, skipped, previous = [] } = input;
  const perQ = engines.filter((e) => ENGINES[e].kind !== "metrics");
  const lines: string[] = [];
  lines.push(`# Search and AI visibility: ${runId}`, "");
  lines.push(`Domain: ${domain}. Queries: ${queries.length}. Estimated spend this run: $${spent.toFixed(3)}.`, "");
  lines.push("Legend: `#N` organic rank (top 20), `+AIO` cited in Google's AI Overview, `(AIO)` overview shown without us, `cited` linked as a source, `named` brand named without a link, `-` not found.", "");

  // share of voice
  lines.push("## Share of voice", "", "| Engine | Found | Checked | Last run |", "|---|---|---|---|");
  for (const e of perQ) {
    const list = obs.filter((o) => o.engine === e && !o.error);
    const found = list.filter((o) => o.cited || (ENGINES[e].kind === "serp" && o.engine !== "google_ai_mode" && o.rank !== null)).length;
    const prev = previous.filter((o) => o.engine === e && !o.error);
    const prevFound = prev.filter((o) => o.cited || (ENGINES[e].kind === "serp" && o.engine !== "google_ai_mode" && o.rank !== null)).length;
    lines.push(`| ${ENGINES[e].label} | ${found} | ${list.length} | ${prev.length ? `${prevFound}/${prev.length}` : "first run"} |`);
  }
  lines.push("");

  if (perQ.length) {
    lines.push("## By query", "", `| Query | ${perQ.map((e) => ENGINES[e].label.split(" (")[0]).join(" | ")} |`, `|---|${perQ.map(() => "---").join("|")}|`);
    for (const q of queries) {
      lines.push(`| ${q.query} | ${perQ.map((e) => cell(obs.find((o) => o.engine === e && o.queryId === q.id))).join(" | ")} |`);
    }
    lines.push("");
  }

  for (const key of ["gsc", "bing_webmaster"] as const) {
    const rows = metrics[key];
    if (!rows) continue;
    lines.push(`## ${ENGINES[key].label}: last 28 days`, "");
    if (!rows.length) {
      lines.push("No data yet (new site, or the property is not verified).", "");
      continue;
    }
    lines.push("| Tracked query | Impressions | Clicks | CTR | Avg position |", "|---|---|---|---|---|");
    for (const q of queries) {
      const m = metricsFor(q, rows);
      lines.push(m ? `| ${q.query} | ${m.impressions} | ${m.clicks} | ${(m.ctr * 100).toFixed(1)}% | ${m.position} |` : `| ${q.query} | 0 | 0 | | |`);
    }
    const top = [...rows].sort((a, b) => b.impressions - a.impressions).slice(0, 15);
    lines.push("", "Top queries overall:", "", "| Query | Impressions | Clicks | Avg position |", "|---|---|---|---|");
    for (const r of top) lines.push(`| ${r.query} | ${r.impressions} | ${r.clicks} | ${r.position.toFixed(1)} |`);
    lines.push("");
  }

  lines.push("## What to fix", "");
  let any = false;
  for (const q of queries) {
    const tips = suggestFixes(
      q,
      obs.filter((o) => o.queryId === q.id),
      { gsc: metrics.gsc ? metricsFor(q, metrics.gsc) : null, bing_webmaster: metrics.bing_webmaster ? metricsFor(q, metrics.bing_webmaster) : null },
    );
    if (!tips.length) continue;
    any = true;
    lines.push(`### ${q.query}`, "", `Target page: ${q.page}`, "", ...tips.map((t) => `- ${t}`), "");
  }
  if (!any) lines.push("Nothing flagged.", "");

  const rivals = topCompetitors(obs, 10);
  if (rivals.length) lines.push("## Domains cited most often instead of us", "", ...rivals.map((d) => `- ${d}`), "");

  const errors = obs.filter((o) => o.error);
  if (errors.length || skipped.length) {
    lines.push("## Not checked", "");
    for (const s of skipped) lines.push(`- ${s}`);
    for (const e of errors.slice(0, 20)) lines.push(`- ${ENGINES[e.engine].label}, "${e.query}": ${e.error}`);
    lines.push("");
  }
  return lines.join("\n");
}

/* ---------- utils ---------- */

export function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
