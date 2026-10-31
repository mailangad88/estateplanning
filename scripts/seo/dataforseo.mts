/**
 * DataForSEO from the command line, with a cache, a dry run and spend caps. See docs/dataforseo.md.
 *
 *   npm run seo -- balance                                     # free: account balance
 *   npm run seo -- volume "living trust cost" "will vs trust" --loc il
 *   npm run seo -- serp "estate planning attorney chicago" --loc chicago
 *   npm run seo -- ideas "living trust" --loc nj --limit 200
 *   npm run seo -- ranked familyfutureplanning.com --loc us --limit 500
 *   npm run seo -- competitors familyfutureplanning.com --limit 50
 *   npm run seo -- page https://familyfutureplanning.com/learn/wills/dying-without-a-will
 *
 * Flags: --dry-run (print the request and estimated cost, call nothing), --fresh (skip the cache),
 *        --out file.json (save the result), --loc il|nj|chicago|us (default us), --limit N.
 * Cache and spend ledger live in .cache/dataforseo/ (gitignored). Cache TTL: DATAFORSEO_CACHE_DAYS (default 7).
 */
import fs from "node:fs";
import path from "node:path";
import {
  DATAFORSEO_BASE,
  ENDPOINTS,
  LOCATIONS,
  USER_DATA_PATH,
  authHeader,
  budgetFromEnv,
  buildTask,
  cacheKey,
  estimateCost,
  monthSpend,
  overBudget,
  readCredentials,
  type Endpoint,
  type LedgerLine,
  type LocationKey,
} from "../../src/lib/dataforseo";

// Load local credentials without a dotenv dependency (Node 22+).
for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) process.loadEnvFile(f);

const CACHE_DIR = path.resolve(".cache/dataforseo");
const LEDGER = path.join(CACHE_DIR, "spend.jsonl");

const argv = process.argv.slice(2);
const flags = new Map<string, string | true>();
const positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--") && ["--loc", "--limit", "--out"].includes(a)) {
      flags.set(a, next);
      i++;
    } else flags.set(a, true);
  } else positional.push(a);
}
const [command, ...rest] = positional;

if (!command || flags.has("--help")) {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]);
  process.exit(command ? 0 : 1);
}

const creds = readCredentials();
const dryRun = flags.has("--dry-run");

async function call(pathname: string, body?: unknown): Promise<any> {
  if (!creds) {
    console.error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are not set. Add them to .env.local (see docs/dataforseo.md).");
    process.exit(2);
  }
  const res = await fetch(`${DATAFORSEO_BASE}/${pathname}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: authHeader(creds.login, creds.password), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || (json.status_code && json.status_code !== 20000)) {
    throw new Error(`DataForSEO ${res.status} ${json.status_code ?? ""} ${json.status_message ?? res.statusText}`);
  }
  return json;
}

function readLedger(): LedgerLine[] {
  if (!fs.existsSync(LEDGER)) return [];
  return fs
    .readFileSync(LEDGER, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LedgerLine);
}

async function main() {
  if (command === "balance") {
    const json = await call(USER_DATA_PATH);
    const r = json.tasks?.[0]?.result?.[0];
    console.log(JSON.stringify({ balance: r?.money?.balance, total_spent: r?.money?.total, local_ledger_this_month: monthSpend(readLedger()) }, null, 2));
    return;
  }
  if (command === "spend") {
    const lines = readLedger();
    console.log(JSON.stringify({ this_month_usd: monthSpend(lines), calls: lines.length }, null, 2));
    return;
  }
  if (!(command in ENDPOINTS)) {
    console.error(`Unknown command "${command}". Use one of: balance, spend, ${Object.keys(ENDPOINTS).join(", ")}`);
    process.exit(1);
  }
  const endpoint = command as Endpoint;
  const loc = (flags.get("--loc") as string | undefined) ?? "us";
  if (!(loc in LOCATIONS)) throw new Error(`--loc must be one of ${Object.keys(LOCATIONS).join(", ")}`);
  const task = buildTask(endpoint, {
    keywords: rest,
    target: rest[0],
    url: rest[0],
    location: loc as LocationKey,
    limit: flags.has("--limit") ? Number(flags.get("--limit")) : undefined,
  });
  const est = estimateCost(endpoint, task);
  const key = cacheKey(endpoint, task);
  const cacheFile = path.join(CACHE_DIR, `${endpoint}-${key}.json`);
  const ttlMs = Number(process.env.DATAFORSEO_CACHE_DAYS ?? 7) * 86_400_000;

  if (dryRun) {
    console.log(JSON.stringify({ endpoint: ENDPOINTS[endpoint].path, task, estimated_usd: est, cached: fs.existsSync(cacheFile) }, null, 2));
    return;
  }

  let result: unknown;
  if (!flags.has("--fresh") && fs.existsSync(cacheFile) && Date.now() - fs.statSync(cacheFile).mtimeMs < ttlMs) {
    result = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    console.error(`cache hit (${path.relative(process.cwd(), cacheFile)}), $0`);
  } else {
    const budget = budgetFromEnv(monthSpend(readLedger()));
    const stop = overBudget(budget, est);
    if (stop) {
      console.error(`Stopped before calling DataForSEO: ${stop}`);
      process.exit(3);
    }
    const json = await call(ENDPOINTS[endpoint].path, [task]);
    const cost = Number(json.cost ?? est);
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), endpoint, cost } satisfies LedgerLine) + "\n");
    result = json.tasks?.[0]?.result ?? [];
    fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2));
    console.error(`cost $${cost.toFixed(4)} (month so far $${(budget.spentThisMonth + cost).toFixed(4)})`);
  }

  const out = flags.get("--out");
  if (typeof out === "string") {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(result, null, 2));
    console.error(`saved ${out}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
