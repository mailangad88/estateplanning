import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  ENGINES,
  ENGINE_KEYS,
  budgetFromEnv,
  engineConfigured,
  isOurs,
  mentionsBrand,
  metricsFor,
  monthSpend,
  normalizeEnv,
  overBudget,
  parseBingQueryStats,
  parseClaude,
  parseDataForSeoSerp,
  parseGemini,
  parseGscRows,
  parseOpenAI,
  parsePerplexity,
  planCost,
  renderReport,
  scoreSources,
  selectQueries,
  suggestFixes,
  type Observation,
  type VisibilityQuery,
} from "@/lib/visibility";

const D = "familyfutureplanning.com";
const queries: VisibilityQuery[] = JSON.parse(fs.readFileSync("content/visibility-queries.json", "utf8")).queries;

describe("query set", () => {
  it("has unique ids, Illinois focus and existing target paths", () => {
    expect(new Set(queries.map((q) => q.id)).size).toBe(queries.length);
    for (const q of queries) {
      expect(q.page.startsWith("/")).toBe(true);
      expect(q.query).not.toMatch(/new jersey/i); // NJ is out of the first launch
      const m = q.page.match(/^\/learn\/([^/]+)\/([^/]+)$/);
      if (m) expect(fs.existsSync(`content/learn/${m[1]}/${m[2]}.md`), q.page).toBe(true);
    }
  });
  it("selects core by default, all with --all, ids and limit", () => {
    expect(selectQueries(queries, {}).every((q) => q.tier === "core")).toBe(true);
    expect(selectQueries(queries, { all: true }).length).toBe(queries.length);
    expect(selectQueries(queries, { ids: ["il-will-cost"] }).map((q) => q.id)).toEqual(["il-will-cost"]);
    expect(selectQueries(queries, { all: true, limit: 2 }).length).toBe(2);
  });
});

describe("engines and env", () => {
  it("only runs engines whose keys are all set", () => {
    expect(engineConfigured("perplexity", {})).toBe(false);
    expect(engineConfigured("perplexity", { PERPLEXITY_API_KEY: "x" })).toBe(true);
    expect(engineConfigured("google_serp", { DATAFORSEO_LOGIN: "a" })).toBe(false);
  });
  it("maps the DATAFORSEO_PSWD alias", () => {
    expect(normalizeEnv({ DATAFORSEO_PSWD: "p" }).DATAFORSEO_PASSWORD).toBe("p");
  });
  it("metrics engines are free and plan as one call", () => {
    for (const k of ENGINE_KEYS) if (ENGINES[k].kind === "metrics") expect(ENGINES[k].estUsd).toBe(0);
    const plan = planCost(["gsc", "perplexity"], 12);
    expect(plan.find((p) => p.engine === "gsc")!.calls).toBe(1);
    expect(plan.find((p) => p.engine === "perplexity")!.calls).toBe(12);
  });
});

describe("budget", () => {
  it("defaults and stops at the run or month cap", () => {
    const b = budgetFromEnv(0, {});
    expect(b.runCap).toBe(3);
    expect(b.monthlyCap).toBe(15);
    expect(overBudget({ ...b, spentThisRun: 2.99 }, 0.03)).toMatch(/run cap/);
    expect(overBudget({ ...b, spentThisMonth: 14.99 }, 0.03)).toMatch(/monthly cap/);
    expect(overBudget(b, 0.03)).toBeNull();
  });
  it("sums only this month", () => {
    const now = new Date("2026-11-15T00:00:00Z");
    expect(monthSpend([{ at: "2026-11-01T00:00:00Z", cost: 0.5 }, { at: "2026-10-30T00:00:00Z", cost: 9 }], now)).toBe(0.5);
  });
});

describe("matching", () => {
  it("recognises our domain, subdomains and the brand", () => {
    expect(isOurs("https://www.familyfutureplanning.com/learn/x", D)).toBe(true);
    expect(isOurs("familyfutureplanning.com", D)).toBe(true);
    expect(isOurs("https://notfamilyfutureplanning.com", D)).toBe(false);
    expect(mentionsBrand("Try Family Future Planning for a match", D)).toBe(true);
  });
  it("scores rank by distinct domain and lists competitors", () => {
    const s = scoreSources(
      [{ url: "https://nolo.com/a" }, { url: "https://nolo.com/b" }, { url: "https://familyfutureplanning.com/pricing" }, { url: "https://avvo.com" }],
      D,
    );
    expect(s.cited).toBe(true);
    expect(s.rank).toBe(2);
    expect(s.competitors).toEqual(["nolo.com", "avvo.com"]);
  });
  it("uses the domain hint for redirect URLs", () => {
    const s = scoreSources([{ url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", domain: D }], D);
    expect(s.cited).toBe(true);
  });
});

describe("parsers", () => {
  it("Perplexity search_results and citations", () => {
    expect(parsePerplexity({ choices: [{ message: { content: "hi" } }], citations: ["https://a.com"] }).sources).toEqual([{ url: "https://a.com" }]);
    expect(parsePerplexity({ search_results: [{ url: "https://b.com", title: "B" }] }).sources[0].url).toBe("https://b.com");
  });
  it("OpenAI url_citation annotations and search sources", () => {
    const r = parseOpenAI({
      output: [
        { type: "web_search_call", action: { sources: [{ url: "https://s.com" }] } },
        { type: "message", content: [{ type: "output_text", text: "Answer", annotations: [{ type: "url_citation", url: "https://c.com" }] }] },
      ],
    });
    expect(r.text).toBe("Answer");
    expect(r.sources.map((s) => s.url)).toEqual(["https://s.com", "https://c.com"]);
  });
  it("Gemini grounding chunks keep the domain title", () => {
    const r = parseGemini({
      candidates: [{ content: { parts: [{ text: "x" }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://redirect", title: "nolo.com" } }] } }],
    });
    expect(r.sources[0].domain).toBe("nolo.com");
  });
  it("Claude prefers cited URLs over raw search results", () => {
    const r = parseClaude([
      { type: "web_search_tool_result", content: [{ url: "https://seen.com" }, { url: "https://cited.com" }] },
      { type: "text", text: "A", citations: [{ url: "https://cited.com" }] },
    ]);
    expect(r.sources.map((s) => s.url)).toEqual(["https://cited.com"]);
    expect(parseClaude([{ type: "web_search_tool_result", content: [{ url: "https://seen.com" }] }]).sources.length).toBe(1);
  });
  it("DataForSEO organic and AI Overview references", () => {
    const r = parseDataForSeoSerp({
      tasks: [{ result: [{ items: [
        { type: "ai_overview", items: [{ type: "ai_overview_element", text: "Probate takes", references: [{ domain: D, url: `https://${D}/learn/x` }] }] },
        { type: "organic", url: "https://nolo.com", domain: "nolo.com" },
        { type: "organic", url: `https://${D}/a`, domain: D },
      ] }] }],
    });
    expect(r.aiOverview).toBe(true);
    expect(r.aiRefs[0].domain).toBe(D);
    expect(r.organic.length).toBe(2);
    expect(r.aiText).toContain("Probate takes");
  });
  it("Search Console rows and Bing daily rows", () => {
    expect(parseGscRows({ rows: [{ keys: ["q", "/p"], clicks: 1, impressions: 10, ctr: 0.1, position: 4 }] })[0].position).toBe(4);
    const b = parseBingQueryStats({ d: [
      { Query: "q", Clicks: 1, Impressions: 10, AvgImpressionPosition: 4 },
      { Query: "q", Clicks: 0, Impressions: 30, AvgImpressionPosition: 8 },
    ] });
    expect(b[0]).toMatchObject({ query: "q", clicks: 1, impressions: 40, position: 7 });
  });
  it("matches metrics rows that contain every meaningful word", () => {
    const m = metricsFor(queries.find((q) => q.id === "il-probate-time")!, [
      { query: "how long does probate take in illinois 2026", clicks: 2, impressions: 50, ctr: 0.04, position: 6 },
      { query: "probate illinois", clicks: 9, impressions: 90, ctr: 0.1, position: 3 },
    ]);
    expect(m?.impressions).toBe(50);
  });
});

describe("suggestions and report", () => {
  const q = queries[0];
  const o = (engine: Observation["engine"], extra: Partial<Observation>): Observation => ({
    at: "", runId: "r", engine, queryId: q.id, query: q.query, cited: false, rank: null, mentioned: false, ourUrls: [], competitors: ["nolo.com"], cost: 0, ...extra,
  });
  it("flags not-found, page-2 rank, AI Overview without us, Bing gap", () => {
    expect(suggestFixes(q, [o("perplexity", {})], {})[0]).toMatch(/Not found in any engine/);
    const tips = suggestFixes(q, [o("google_serp", { rank: 7, aiOverview: true }), o("bing_serp", {})], {});
    expect(tips.join("\n")).toMatch(/Google rank #7/);
    expect(tips.join("\n")).toMatch(/AI Overview/);
    expect(tips.join("\n")).toMatch(/Bing/);
  });
  it("renders a report with a row per query", () => {
    const md = renderReport({ runId: "r", domain: D, engines: ["google_serp", "claude"], queries: [q], obs: [o("google_serp", { rank: 2 }), o("claude", { cited: true, rank: 1 })], metrics: {}, spent: 0.03, skipped: ["x"] });
    expect(md).toContain(`| ${q.query} | #2 | cited #1 |`);
    expect(md).toContain("## What to fix");
  });
});
