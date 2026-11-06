# DataForSEO: data for every SEO decision

DataForSEO gives us real search data: keyword volumes, Google results for a keyword in Chicago, Illinois
or New Jersey, the keywords our domain ranks for, who we compete with, and on-page audits. It is pay as
you go with no subscription, so it fits the lowest-cost rule.

There are two ways to use it. Both read the same two credentials.

| Way | For | Where |
| --- | --- | --- |
| `npm run seo -- <command>` | Repeatable checks, scripts, CI, saved reports | `scripts/seo/dataforseo.mts`, `src/lib/dataforseo.ts` |
| DataForSEO MCP server | Claude sessions asking ad-hoc questions ("what does the Chicago top 10 look like for living trust lawyer?") | `.mcp.json` (`dataforseo-mcp-server@3.1.3`) |

## Setup (Angad, one time)

1. Sign up at https://app.dataforseo.com/register. New accounts get a small free trial credit (about $1),
   which is enough to test everything below. Topping up later is a $50 minimum.
2. Copy the **API login and API password** from https://app.dataforseo.com/api-access. These are not your
   dashboard password.
3. Put them where the tools run:
   - Local: `.env.local` (gitignored) with `DATAFORSEO_LOGIN=` and `DATAFORSEO_PASSWORD=`.
   - Claude cloud sessions: add both as environment variables on the project's cloud environment, and add
     `api.dataforseo.com` to its allowed domains (the default network policy blocks it).
   - CI, if we schedule reports: GitHub Actions secrets with the same names.
4. Check it: `npm run seo -- balance` (free call).

## Commands

```bash
npm run seo -- balance                                   # free: account balance + our local spend this month
npm run seo -- spend                                     # free: local ledger only
npm run seo -- volume "living trust cost" "will vs trust" --loc il
npm run seo -- serp "estate planning attorney chicago" --loc chicago
npm run seo -- ideas "living trust" --limit 200
npm run seo -- ranked familyfutureplanning.com --limit 500
npm run seo -- competitors familyfutureplanning.com --limit 50
npm run seo -- page https://familyfutureplanning.com/learn/wills/dying-without-a-will
```

Locations: `--loc il | nj | chicago | us` (default `us`). Keyword ideas, ranked keywords and competitors are
country-level data in DataForSEO, so those always use the US.

Every command takes `--dry-run` (prints the request and estimated cost, spends nothing), `--fresh` (skip
the cache) and `--out file.json`.

## Spend guards

- **Cache.** An identical request within 7 days (`DATAFORSEO_CACHE_DAYS`) is answered from
  `.cache/dataforseo/` for $0.
- **Run cap.** A run stops before any call that would pass `DATAFORSEO_MAX_SPEND_USD` (default $1).
- **Monthly cap.** A call is refused when this month's ledger would pass `DATAFORSEO_MONTHLY_CAP_USD`
  (default $10). The ledger is `.cache/dataforseo/spend.jsonl` and records the cost DataForSEO returns.
- The MCP server has no caps of its own. Keep it for questions, and use the script for anything bulk.
- Backlinks API is not wired in on purpose: it has a $100/month minimum.

## Cheap-usage plan

Prices are DataForSEO list prices as of October 2026 and are estimates. Check https://dataforseo.com/pricing
before a large run.

| Job | How often | Calls | Est. cost |
| --- | --- | --- | --- |
| Rank check: top 10 for 50 money keywords in Chicago, IL and NJ | Weekly | 150 SERPs × $0.002 | ~$1.30/month |
| Search volume for the whole topic bank (2,000+ keywords, IL and NJ) | Monthly | ~6 calls × $0.075 | ~$0.45/month |
| Keywords we rank for (domain, top 1,000) | Weekly once live | 1 × ~$0.11 | ~$0.45/month |
| Competitor domains | Monthly | 1 × ~$0.02 | ~$0.02/month |
| Keyword ideas for new clusters | As needed | ~10 × ~$0.03 | ~$0.30/month |
| On-page audit of new and changed pages | Per release | ~500 pages × $0.000125 | ~$0.06/release |
| **Total** |  |  | **~$2.50–4/month** |

At that rate the $50 minimum top-up lasts more than a year. The free trial credit covers setup and a first
baseline. Ranked keywords will be close to empty until familyfutureplanning.com is live and indexed, so
before launch the useful jobs are search volume, SERPs and competitors.

## Who uses it

- SEO content engine: pick and order topics by real IL/NJ volume, check the top 10 before writing, and
  re-check after publishing.
- Plan to rank first: weekly rank check against the gap analysis targets.
- Any thread: ask the MCP server directly for one-off questions.
