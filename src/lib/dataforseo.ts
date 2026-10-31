/**
 * DataForSEO client for site analysis (keyword volumes, SERPs, rankings, page audits).
 *
 * Pay as you go, so every call goes through three guards:
 *  1. a local cache (identical request within the TTL costs nothing),
 *  2. a per-run budget (DATAFORSEO_MAX_SPEND_USD, default $1),
 *  3. a monthly cap read from the local spend ledger (DATAFORSEO_MONTHLY_CAP_USD, default $10).
 *
 * Credentials: DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD (the API login from
 * https://app.dataforseo.com/api-access, not the dashboard password). Never commit them.
 * Used by scripts/seo/dataforseo.mts and by the MCP server in .mcp.json. See docs/dataforseo.md.
 */
import { createHash } from "node:crypto";

export const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";

/** Launch states (IL + NJ). DataForSEO location_name values. */
export const LOCATIONS = {
  il: "Illinois,United States",
  nj: "New Jersey,United States",
  chicago: "Chicago,Illinois,United States",
  us: "United States",
} as const;
export type LocationKey = keyof typeof LOCATIONS;

export type Endpoint =
  | "serp"
  | "volume"
  | "ideas"
  | "ranked"
  | "competitors"
  | "page";

/** Path, upper-bound estimate in USD, and whether the cost grows with result rows. Check https://dataforseo.com/pricing before big runs. */
export const ENDPOINTS: Record<Endpoint, { path: string; estUsd: number; perItemUsd: number; note: string }> = {
  serp: { path: "serp/google/organic/live/advanced", estUsd: 0.002, perItemUsd: 0, note: "Top results for one keyword in one location" },
  volume: { path: "keywords_data/google_ads/search_volume/live", estUsd: 0.075, perItemUsd: 0, note: "Monthly volume, CPC, competition for up to 1,000 keywords per call" },
  ideas: { path: "dataforseo_labs/google/keyword_ideas/live", estUsd: 0.01, perItemUsd: 0.0001, note: "Related keyword ideas with volume" },
  ranked: { path: "dataforseo_labs/google/ranked_keywords/live", estUsd: 0.01, perItemUsd: 0.0001, note: "Keywords a domain ranks for, with position" },
  competitors: { path: "dataforseo_labs/google/competitors_domain/live", estUsd: 0.01, perItemUsd: 0.0001, note: "Domains competing for the same keywords" },
  page: { path: "on_page/instant_pages", estUsd: 0.000125, perItemUsd: 0, note: "On-page audit of one URL (title, meta, headings, speed, errors)" },
};

/** Free account endpoint: balance and limits. */
export const USER_DATA_PATH = "appendix/user_data";

export type Task = Record<string, unknown>;
export type Env = Record<string, string | undefined>;

export function estimateCost(endpoint: Endpoint, task: Task): number {
  const spec = ENDPOINTS[endpoint];
  const limit = typeof task.limit === "number" ? task.limit : 0;
  return round(spec.estUsd + spec.perItemUsd * limit);
}

export function cacheKey(endpoint: Endpoint, task: Task): string {
  return createHash("sha256").update(`${ENDPOINTS[endpoint].path}\n${stableStringify(task)}`).digest("hex").slice(0, 32);
}

/** JSON with sorted keys, so { a, b } and { b, a } share a cache entry. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function authHeader(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

export function readCredentials(env: Env = process.env): { login: string; password: string } | null {
  const login = env.DATAFORSEO_LOGIN || env.DATAFORSEO_USERNAME;
  const password = env.DATAFORSEO_PASSWORD;
  return login && password ? { login, password } : null;
}

export interface BudgetState {
  runCap: number;
  monthlyCap: number;
  spentThisRun: number;
  spentThisMonth: number;
}

export function budgetFromEnv(spentThisMonth: number, env: Env = process.env): BudgetState {
  return {
    runCap: num(env.DATAFORSEO_MAX_SPEND_USD, 1),
    monthlyCap: num(env.DATAFORSEO_MONTHLY_CAP_USD, 10),
    spentThisRun: 0,
    spentThisMonth,
  };
}

/** Returns a reason string when the next call would break a cap, otherwise null. */
export function overBudget(state: BudgetState, nextEstimate: number): string | null {
  if (state.spentThisRun + nextEstimate > state.runCap) {
    return `run cap $${state.runCap.toFixed(2)} would be passed (spent $${state.spentThisRun.toFixed(4)}, next ~$${nextEstimate.toFixed(4)}). Raise DATAFORSEO_MAX_SPEND_USD to continue.`;
  }
  if (state.spentThisMonth + nextEstimate > state.monthlyCap) {
    return `monthly cap $${state.monthlyCap.toFixed(2)} would be passed (spent $${state.spentThisMonth.toFixed(4)} this month). Raise DATAFORSEO_MONTHLY_CAP_USD to continue.`;
  }
  return null;
}

export interface LedgerLine {
  at: string;
  endpoint: string;
  cost: number;
}

/** Sum of ledger costs in the same calendar month (UTC) as `now`. */
export function monthSpend(lines: LedgerLine[], now: Date = new Date()): number {
  const ym = now.toISOString().slice(0, 7);
  return round(lines.filter((l) => l.at.slice(0, 7) === ym).reduce((sum, l) => sum + (Number(l.cost) || 0), 0));
}

/** Builds the request task for each endpoint from CLI-style options. */
export function buildTask(
  endpoint: Endpoint,
  opts: { keywords?: string[]; target?: string; url?: string; location?: LocationKey; limit?: number },
): Task {
  const location_name = LOCATIONS[opts.location ?? "us"];
  const language_code = "en";
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 1000);
  switch (endpoint) {
    case "serp":
      return { keyword: need(opts.keywords?.[0], "keyword"), location_name, language_code, depth: 10 };
    case "volume":
      return { keywords: need(opts.keywords?.length ? opts.keywords.slice(0, 1000) : undefined, "keywords"), location_name, language_code };
    case "ideas":
      return { keywords: need(opts.keywords?.length ? opts.keywords.slice(0, 200) : undefined, "keywords"), location_name: LOCATIONS.us, language_code, limit };
    // DataForSEO Labs data is country level, so these always use the US.
    case "ranked":
    case "competitors":
      return { target: need(opts.target, "target domain"), location_name: LOCATIONS.us, language_code, limit };
    case "page":
      return { url: need(opts.url, "url") };
  }
}

function need<T>(v: T | undefined, what: string): T {
  if (v === undefined || v === "") throw new Error(`missing ${what}`);
  return v;
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
