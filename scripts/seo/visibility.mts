/**
 * Search and AI visibility tracker. See docs/ai-visibility.md.
 *
 *   npm run visibility -- engines                 # which engines have keys, what they cost (free, calls nothing)
 *   npm run visibility -- run --dry-run           # planned calls and estimated spend, calls nothing
 *   npm run visibility -- run                     # core queries, every configured engine
 *   npm run visibility -- run --all               # core + extended queries
 *   npm run visibility -- run --engines perplexity,claude --queries il-probate-cost,il-will-cost
 *   npm run visibility -- report                  # rebuild the report from the last run (free)
 *
 * Flags: --dry-run, --fresh (skip the cache), --all, --limit N, --engines a,b, --queries id1,id2,
 *        --domain example.com (default familyfutureplanning.com).
 * Data: VISIBILITY_DATA_DIR (default .cache/visibility): results.jsonl (every observation, for trends),
 *       spend.jsonl (ledger for the monthly cap), cache/, reports/<date>.md and latest.md.
 * Caps: VISIBILITY_MAX_SPEND_USD (default 3 per run), VISIBILITY_MONTHLY_CAP_USD (default 15),
 *       VISIBILITY_CACHE_DAYS (default 6, so a weekly run is always fresh but reruns are free).
 */
import fs from "node:fs";
import path from "node:path";
import { createSign } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import {
  ENGINES,
  ENGINE_KEYS,
  budgetFromEnv,
  cacheKey,
  engineConfigured,
  mentionsBrand,
  monthSpend,
  normalizeEnv,
  overBudget,
  parseBingQueryStats,
  parseBrave,
  parseClaude,
  parseDataForSeoSerp,
  parseGemini,
  parseGscRows,
  parseOpenAI,
  parsePerplexity,
  planCost,
  renderReport,
  round,
  scoreSources,
  selectQueries,
  isOurs,
  num,
  type EngineKey,
  type Observation,
  type QueryMetric,
  type Source,
  type VisibilityQuery,
} from "../../src/lib/visibility";

for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) process.loadEnvFile(f);
const env = normalizeEnv(process.env);

/* ---------- args ---------- */
const argv = process.argv.slice(2);
const flags = new Map<string, string | true>();
const positional: string[] = [];
const VALUE_FLAGS = ["--limit", "--engines", "--queries", "--domain"];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    if (VALUE_FLAGS.includes(a) && argv[i + 1] !== undefined) flags.set(a, argv[++i]);
    else flags.set(a, true);
  } else positional.push(a);
}
const command = positional[0];
if (!command || flags.has("--help")) {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]);
  process.exit(command ? 0 : 1);
}

const DOMAIN = String(flags.get("--domain") ?? env.VISIBILITY_DOMAIN ?? "familyfutureplanning.com").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
const DATA = path.resolve(env.VISIBILITY_DATA_DIR || ".cache/visibility");
const RESULTS = path.join(DATA, "results.jsonl");
const LEDGER = path.join(DATA, "spend.jsonl");
const CACHE = path.join(DATA, "cache");
const REPORTS = path.join(DATA, "reports");
const CACHE_MS = num(env.VISIBILITY_CACHE_DAYS, 6) * 86_400_000;
const dryRun = flags.has("--dry-run");
const fresh = flags.has("--fresh");

const allQueries: VisibilityQuery[] = JSON.parse(fs.readFileSync("content/visibility-queries.json", "utf8")).queries;
const queries = selectQueries(allQueries, {
  all: flags.has("--all"),
  ids: typeof flags.get("--queries") === "string" ? String(flags.get("--queries")).split(",") : undefined,
  limit: Number(flags.get("--limit")) || undefined,
});

function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((l) => {
    try {
      return [JSON.parse(l) as T];
    } catch {
      return [];
    }
  });
}
function append(file: string, rows: unknown[]) {
  if (!rows.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

/* ---------- engines command ---------- */
if (command === "engines") {
  console.log(`Domain: ${DOMAIN}\n`);
  for (const k of ENGINE_KEYS) {
    const e = ENGINES[k];
    const on = engineConfigured(k, env);
    console.log(`${on ? "ON " : "off"}  ${k.padEnd(15)} ${e.label}`);
    console.log(`     env: ${e.env.join(", ")}   ~$${e.estUsd}/${e.kind === "metrics" ? "run" : "query"}   hosts: ${e.hosts.join(", ")}`);
    console.log(`     ${e.what}\n`);
  }
  process.exit(0);
}

/* ---------- report command ---------- */
if (command === "report") {
  const all = readJsonl<Observation & { kind?: string }>(RESULTS);
  const runs = [...new Set(all.map((o) => o.runId))];
  const last = runs.at(-1);
  if (!last) {
    console.error(`No runs in ${RESULTS} yet. Run: npm run visibility -- run`);
    process.exit(1);
  }
  const metricRows = readJsonl<{ runId: string; engine: "gsc" | "bing_webmaster"; rows: QueryMetric[] }>(path.join(DATA, "metrics.jsonl")).filter((m) => m.runId === last);
  const obs = all.filter((o) => o.runId === last);
  const md = renderReport({
    runId: last,
    domain: DOMAIN,
    engines: [...new Set([...obs.map((o) => o.engine), ...metricRows.map((m) => m.engine)])],
    queries: allQueries.filter((q) => obs.some((o) => o.queryId === q.id)),
    obs,
    metrics: Object.fromEntries(metricRows.map((m) => [m.engine, m.rows])),
    spent: round(readJsonl<{ runId: string; cost: number }>(LEDGER).filter((l) => l.runId === last).reduce((s, l) => s + l.cost, 0)),
    skipped: [],
    previous: all.filter((o) => o.runId === runs.at(-2)),
  });
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(DATA, "latest.md"), md);
  console.log(md);
  process.exit(0);
}

if (command !== "run") {
  console.error(`Unknown command "${command}". Use engines, run or report.`);
  process.exit(1);
}

/* ---------- run command ---------- */
const wanted = typeof flags.get("--engines") === "string" ? (String(flags.get("--engines")).split(",") as EngineKey[]) : ENGINE_KEYS;
const bad = wanted.filter((e) => !ENGINES[e]);
if (bad.length) {
  console.error(`Unknown engine(s): ${bad.join(", ")}. Known: ${ENGINE_KEYS.join(", ")}`);
  process.exit(1);
}
const engines = wanted.filter((e) => engineConfigured(e, env));
const skipped = wanted.filter((e) => !engineConfigured(e, env)).map((e) => `${ENGINES[e].label}: set ${ENGINES[e].env.join(" and ")}`);

const plan = planCost(engines, queries.length);
const planned = round(plan.reduce((s, p) => s + p.usd, 0));
console.log(`Domain ${DOMAIN}, ${queries.length} queries, engines: ${engines.join(", ") || "none configured"}`);
for (const p of plan) console.log(`  ${p.engine.padEnd(15)} ${String(p.calls).padStart(3)} calls  ~$${p.usd.toFixed(3)}`);
console.log(`  planned (before cache): ~$${planned.toFixed(3)}`);
for (const s of skipped) console.log(`  skipped ${s}`);
if (dryRun) process.exit(0);
if (!engines.length) {
  // Not an error: the weekly job runs before any key is added and should stay green.
  console.log("\nNo engine has credentials yet. Run `npm run visibility -- engines` to see the env var names.");
  process.exit(0);
}

const ledger = readJsonl<{ at: string; cost: number }>(LEDGER);
const budget = budgetFromEnv(monthSpend(ledger), env);
const runId = new Date().toISOString().slice(0, 16).replace("T", " ");
const spendRows: unknown[] = [];

async function getJson(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(90_000) });
  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* keep text for the error */
  }
  if (!res.ok) throw new Error(`${res.status} ${(json?.error?.message ?? json?.message ?? text).toString().slice(0, 200)}`);
  return json;
}

/** One engine x query lookup, cached; returns sources + text for answer engines or a SERP parse. */
async function cached<T>(engine: EngineKey, q: string, fn: () => Promise<T>): Promise<{ value: T; cached: boolean; cost: number }> {
  const file = path.join(CACHE, `${cacheKey(engine, q, DOMAIN)}.json`);
  if (!fresh && fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < CACHE_MS) {
    return { value: JSON.parse(fs.readFileSync(file, "utf8")), cached: true, cost: 0 };
  }
  const est = ENGINES[engine].estUsd;
  const stop = overBudget(budget, est);
  if (stop) throw new BudgetError(stop);
  const value = await fn();
  budget.spentThisRun = round(budget.spentThisRun + est);
  budget.spentThisMonth = round(budget.spentThisMonth + est);
  spendRows.push({ at: new Date().toISOString(), runId, engine, cost: est });
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
  return { value, cached: false, cost: est };
}
class BudgetError extends Error {}

/* ---- answer engines ---- */
const IL = { country: "US", region: "Illinois", city: "Chicago" };

async function askPerplexity(q: string) {
  const json = await getJson("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.PERPLEXITY_MODEL || "sonar",
      messages: [{ role: "user", content: q }],
      web_search_options: { search_context_size: "low", user_location: { country: IL.country, region: IL.region, city: IL.city } },
    }),
  });
  return parsePerplexity(json);
}

async function askOpenAI(q: string) {
  const json = await getJson("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_VISIBILITY_MODEL || "gpt-5-mini",
      input: q,
      tools: [{ type: "web_search", user_location: { type: "approximate", country: IL.country, region: IL.region, city: IL.city } }],
      include: ["web_search_call.action.sources"],
    }),
  });
  return parseOpenAI(json);
}

async function askGemini(q: string) {
  const model = env.GEMINI_VISIBILITY_MODEL || "gemini-2.5-flash";
  const json = await getJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": String(env.GEMINI_API_KEY), "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: q }] }], tools: [{ google_search: {} }] }),
  });
  return parseGemini(json);
}

let anthropic: Anthropic | null = null;
async function askClaude(q: string) {
  anthropic ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = env.CLAUDE_VISIBILITY_MODEL || "claude-haiku-5-5";
  // The dynamic-filtering search tool runs on Opus and Sonnet; other models take the basic one.
  const tool = /opus|sonnet/.test(model)
    ? ({ type: "web_search_20260209", name: "web_search", max_uses: 2, user_location: { type: "approximate", ...IL } } as const)
    : ({ type: "web_search_20250305", name: "web_search", max_uses: 2, user_location: { type: "approximate", ...IL } } as const);
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    tools: [tool as any],
    messages: [{ role: "user", content: q }],
  });
  return parseClaude(msg.content as any[]);
}

/* ---- SERP engines ---- */
const DFS_LOCATION = "Illinois,United States";
function dfsAuth() {
  return `Basic ${Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString("base64")}`;
}
async function dfs(pathname: string, task: Record<string, unknown>) {
  const json = await getJson(`https://api.dataforseo.com/v3/${pathname}`, {
    method: "POST",
    headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
    body: JSON.stringify([task]),
  });
  const t = json?.tasks?.[0];
  if (t && t.status_code !== 20000) throw new Error(`DataForSEO ${t.status_code} ${t.status_message}`);
  return parseDataForSeoSerp(json);
}
const googleSerp = (q: string) =>
  dfs("serp/google/organic/live/advanced", { keyword: q, location_name: DFS_LOCATION, language_code: "en", depth: 20, load_async_ai_overview: true });
const googleAiMode = (q: string) => dfs("serp/google/ai_mode/live/advanced", { keyword: q, location_name: DFS_LOCATION, language_code: "en" });
const bingSerp = (q: string) => dfs("serp/bing/organic/live/advanced", { keyword: q, location_name: DFS_LOCATION, language_code: "en", depth: 20 });

async function braveSerp(q: string) {
  const u = new URL("https://api.search.brave.com/res/v1/web/search");
  u.searchParams.set("q", q);
  u.searchParams.set("country", "US");
  u.searchParams.set("count", "20");
  const json = await getJson(u.toString(), { headers: { "X-Subscription-Token": String(env.BRAVE_SEARCH_API_KEY), Accept: "application/json" } });
  return parseBrave(json);
}

/* ---- metrics engines ---- */
function isoDay(offsetDays: number) {
  return new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function gscToken(): Promise<string> {
  let raw = String(env.GSC_SERVICE_ACCOUNT_JSON).trim();
  if (!raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  const json = await getJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  return json.access_token;
}

async function gscRows(): Promise<QueryMetric[]> {
  const token = await gscToken();
  const site = env.GSC_SITE_URL || `sc-domain:${DOMAIN}`;
  const json = await getJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    // Search Console data lags about 2 days.
    body: JSON.stringify({ startDate: isoDay(30), endDate: isoDay(2), dimensions: ["query", "page"], rowLimit: 5000, dataState: "final" }),
  });
  return parseGscRows(json);
}

async function bingRows(): Promise<QueryMetric[]> {
  const u = new URL("https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats");
  u.searchParams.set("apikey", String(env.BING_WEBMASTER_API_KEY));
  u.searchParams.set("siteUrl", env.BING_SITE_URL || `https://${DOMAIN}/`);
  const json = await getJson(u.toString());
  const cutoff = Date.now() - 28 * 86_400_000;
  // Dates come back as "/Date(1730000000000)/".
  json.d = (json.d ?? []).filter((r: any) => {
    const ms = Number(String(r.Date ?? "").match(/\d{10,}/)?.[0]);
    return !ms || ms >= cutoff;
  });
  return parseBingQueryStats(json);
}

/* ---------- main loop ---------- */
const observations: Observation[] = [];
const metrics: Partial<Record<"gsc" | "bing_webmaster", QueryMetric[]>> = {};
let stopped: string | null = null;

for (const e of engines.filter((k) => ENGINES[k].kind === "metrics") as ("gsc" | "bing_webmaster")[]) {
  try {
    metrics[e] = e === "gsc" ? await gscRows() : await bingRows();
    console.log(`${e}: ${metrics[e]!.length} query rows`);
  } catch (err) {
    skipped.push(`${ENGINES[e].label}: ${(err as Error).message}`);
  }
}

const perQuery = engines.filter((k) => ENGINES[k].kind !== "metrics");
outer: for (const q of queries) {
  // Engines for one query run in parallel; queries run one after another to stay polite on rate limits.
  const results = await Promise.all(
    perQuery.map(async (engine): Promise<Observation | null> => {
      const base = { at: new Date().toISOString(), runId, engine, queryId: q.id, query: q.query };
      try {
        if (engine === "google_serp" || engine === "bing_serp" || engine === "google_ai_mode") {
          const fn = engine === "google_serp" ? googleSerp : engine === "bing_serp" ? bingSerp : googleAiMode;
          const { value, cached: hit, cost } = await cached(engine, q.query, () => fn(q.query));
          const organicRank = value.organic.findIndex((s) => isOurs(s.url, DOMAIN) || (s.domain ? isOurs(s.domain, DOMAIN) : false));
          const ai = scoreSources(value.aiRefs, DOMAIN);
          const serpScore = scoreSources(engine === "google_ai_mode" ? value.aiRefs : value.organic, DOMAIN);
          return {
            ...base,
            cited: ai.cited,
            rank: engine === "google_ai_mode" ? ai.rank : organicRank >= 0 ? organicRank + 1 : null,
            mentioned: mentionsBrand(value.aiText, DOMAIN),
            ourUrls: [...new Set([...serpScore.ourUrls, ...ai.ourUrls])],
            competitors: serpScore.competitors,
            aiOverview: engine === "google_serp" ? value.aiOverview : undefined,
            answer: value.aiText ? value.aiText.slice(0, 400).trim() : undefined,
            cost,
            cached: hit,
          };
        }
        if (engine === "brave") {
          const { value, cached: hit, cost } = await cached(engine, q.query, () => braveSerp(q.query));
          const s = scoreSources(value.sources, DOMAIN);
          const idx = value.sources.findIndex((x) => isOurs(x.url, DOMAIN));
          return { ...base, ...s, cited: false, rank: idx >= 0 ? idx + 1 : null, mentioned: false, cost, cached: hit };
        }
        const ask = { chatgpt: askOpenAI, perplexity: askPerplexity, gemini: askGemini, claude: askClaude }[engine as "chatgpt"];
        const { value, cached: hit, cost } = await cached(engine, q.query, () => ask(q.query));
        const s = scoreSources(value.sources as Source[], DOMAIN);
        return { ...base, ...s, mentioned: mentionsBrand(value.text, DOMAIN), answer: value.text.slice(0, 400).trim(), cost, cached: hit };
      } catch (err) {
        if (err instanceof BudgetError) {
          stopped = err.message;
          return null;
        }
        return { ...base, cited: false, rank: null, mentioned: false, ourUrls: [], competitors: [], cost: 0, error: (err as Error).message.slice(0, 300) };
      }
    }),
  );
  for (const r of results) if (r) observations.push(r);
  const line = results.filter(Boolean).map((r) => `${r!.engine}:${r!.error ? "err" : r!.cited ? "cited" : r!.rank ? `#${r!.rank}` : "-"}`).join(" ");
  console.log(`${q.id.padEnd(26)} ${line}`);
  if (stopped) break outer;
}

append(RESULTS, observations);
append(LEDGER, spendRows);
append(path.join(DATA, "metrics.jsonl"), Object.entries(metrics).map(([engine, rows]) => ({ runId, at: new Date().toISOString(), engine, rows })));
if (stopped) skipped.push(`Stopped early: ${stopped}`);

const runs = [...new Set(readJsonl<Observation>(RESULTS).map((o) => o.runId))];
const prevRun = runs.filter((r) => r !== runId).at(-1);
const md = renderReport({
  runId,
  domain: DOMAIN,
  engines,
  queries,
  obs: observations,
  metrics,
  spent: budget.spentThisRun,
  skipped,
  previous: prevRun ? readJsonl<Observation>(RESULTS).filter((o) => o.runId === prevRun) : [],
});
fs.mkdirSync(REPORTS, { recursive: true });
fs.writeFileSync(path.join(REPORTS, `${runId.slice(0, 10)}.md`), md);
fs.writeFileSync(path.join(DATA, "latest.md"), md);
console.log(`\nSpent ~$${budget.spentThisRun.toFixed(3)} this run, ~$${budget.spentThisMonth.toFixed(3)} this month. Report: ${path.join(DATA, "latest.md")}`);
