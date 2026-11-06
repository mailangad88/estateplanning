# Visibility tracker: are we ranked or cited in every search and AI engine?

`npm run visibility` asks each engine our money keywords and questions (`content/visibility-queries.json`,
12 core + 12 extended, Illinois only for the first launch) and records, per query and engine, whether
familyfutureplanning.com ranks, is cited as a source, or is named without a link. Every run is appended
to a history file, so the report shows change since the last run, which domains are cited instead of us,
and a short fix list per query. This is part of the search visibility work in `docs/search-visibility.md`.

```
npm run visibility -- engines          # which engines have keys, cost per query, hosts to allow (free)
npm run visibility -- run --dry-run    # planned calls and estimated spend, calls nothing
npm run visibility -- run              # 12 core queries on every engine that has a key
npm run visibility -- run --all        # all 24 queries
npm run visibility -- run --engines perplexity,claude --queries il-will-cost
npm run visibility -- report           # rebuild the last report (free)
```

A weekly GitHub Action (`.github/workflows/visibility.yml`, Mondays 8am Chicago, or Actions > Search and AI
visibility > Run workflow) runs it with repository secrets. GitHub's runners have open internet, so this is
the simplest place to run it. With no secrets it does nothing and stays green. The report shows up as the
job summary; history and the spend ledger carry over in the Actions cache.

## Engines, cost and what you need

Prices are estimates from October 2026 public pricing; the tracker's caps use these upper bounds. Check the
provider's pricing page before adding a large query set.

| Engine | What it tells us | Key(s) to add | Est. cost | Worth it? |
|---|---|---|---|---|
| Google Search Console | Real Google impressions, clicks, CTR and position per query | `GSC_SERVICE_ACCOUNT_JSON` | Free | **Yes, first.** After launch |
| Bing Webmaster Tools | Same for Bing, which feeds ChatGPT search, Copilot and DuckDuckGo | `BING_WEBMASTER_API_KEY` | Free | **Yes, first.** After launch |
| Google results + AI Overview (DataForSEO) | Our Illinois rank in the top 20 and whether the AI Overview cites us | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | ~$0.006 / query | **Yes.** Account already exists |
| Google AI Mode (DataForSEO) | Which sites AI Mode links to | same | ~$0.006 / query | Yes |
| Bing results (DataForSEO) | Our Bing rank | same | ~$0.004 / query | Yes |
| Perplexity (Sonar API) | Citations in Perplexity's answer | `PERPLEXITY_API_KEY` | ~$0.008 / query | **Yes**, cheapest answer engine |
| Gemini (Search grounding) | Sources Gemini grounds its answer on | `GEMINI_API_KEY` | Free daily allowance, then a few cents | **Yes**, usually free |
| Claude (web search) | URLs Claude cites | `ANTHROPIC_API_KEY` | ~$0.025 / query ($10 per 1,000 searches, 2 max, Haiku tokens) | Yes |
| ChatGPT (OpenAI web search) | URLs the answer cites | `OPENAI_API_KEY` | ~$0.03 / query ($10 per 1,000 searches + tokens) | Yes; closest to ChatGPT search |
| Brave Search | Our Brave rank (an index some assistants use) | `BRAVE_SEARCH_API_KEY` | ~$0.005 / query, monthly free credit | Optional |

Not tracked and why: **Microsoft Copilot** and **DuckDuckGo** have no answer API; they read Bing, so Bing
Webmaster plus the Bing rank cover them. **ChatGPT app** answers can differ from the API; the OpenAI web
search tool is the nearest thing with an API. Paid trackers (Profound, Peec, Otterly, $29 to $500+ a month)
do the same job with more prompts; not needed at this size.

**Cost of a weekly run, every engine, 12 core queries: about $1.40 upper bound, so about $6 a month.**
DataForSEO only is about $0.20 a run. Caps: `VISIBILITY_MAX_SPEND_USD` (default $3 per run) and
`VISIBILITY_MONTHLY_CAP_USD` (default $15), checked before every paid call. The cache
(`VISIBILITY_CACHE_DAYS`, default 6) makes reruns in the same week free.

## Getting each key (Angad)

Put keys in **GitHub > repo Settings > Secrets and variables > Actions > New repository secret** with the
exact names below. To also run it from a Claude session, add the same names to the project's cloud
environment variables and its network Allowed domains (hosts listed by `npm run visibility -- engines`).
Never paste a key in chat.

1. **Search Console (free, after launch).** console.cloud.google.com > create project "ffp-search" > APIs & Services > Library > enable **Google Search Console API** > IAM & Admin > Service accounts > Create > no roles > Keys > Add key > JSON (downloads a file). In Search Console > Settings > Users and permissions > Add user > paste the service account's email, permission **Restricted**. Secret `GSC_SERVICE_ACCOUNT_JSON` = the whole JSON file contents. The tracker uses the Domain property `sc-domain:familyfutureplanning.com`; set `GSC_SITE_URL` only for a URL-prefix property.
2. **Bing Webmaster (free, after launch).** bing.com/webmasters > Settings (gear) > API access > API Key > Generate. Secret `BING_WEBMASTER_API_KEY`.
3. **DataForSEO.** Same API login and password as the DataForSEO setup. Secrets `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` (the cloud environment's `DATAFORSEO_PSWD` name is also accepted).
4. **Perplexity.** perplexity.ai > Settings > API > add credit ($5 is plenty) > Generate API key. Secret `PERPLEXITY_API_KEY`.
5. **Gemini.** aistudio.google.com/apikey > Create API key. Secret `GEMINI_API_KEY`. Free tier is enough to start.
6. **Claude.** console.anthropic.com > API keys > Create key; add $5 credit. Secret `ANTHROPIC_API_KEY`.
7. **OpenAI.** platform.openai.com/api-keys > Create new secret key; add $5 credit. Secret `OPENAI_API_KEY`.
8. **Brave (optional).** api-dashboard.search.brave.com > subscribe to the free/base plan > API key. Secret `BRAVE_SEARCH_API_KEY`.

Optional repository **variables** (not secrets): `VISIBILITY_MAX_SPEND_USD`, `VISIBILITY_MONTHLY_CAP_USD`.

## Reading the report

`#N` organic rank, `+AIO` cited in Google's AI Overview, `(AIO)` overview shown without us, `cited` linked as a
source by an AI engine (with its position among cited domains), `named` brand named without a link, `-` not
found. "What to fix" turns gaps into actions: not found anywhere (answer-first rewrite, facts the cited pages
have), Google rank 4 to 20 (internal links, title), AI Overview without us (answer box, FAQ), ranks on
Google but not Bing (Bing URL Inspection, IndexNow), ranks but no AI citation (quotable summary, reviewer and
date, figures table), and Search Console high impressions with low CTR (title and description).

Before launch every cell will be `-`, but the run is still useful: it shows who AI engines cite for our
questions today, which is the list of pages to beat.

## Files

- `content/visibility-queries.json`: the query set and the page we want cited for each. Edit freely.
- `src/lib/visibility.ts`: engine registry, costs, budget, citation matching, response parsers, fix rules, report.
- `scripts/seo/visibility.mts`: the CLI and API calls.
- `.cache/visibility/` (gitignored; `VISIBILITY_DATA_DIR` to move it): `results.jsonl` history, `metrics.jsonl`, `spend.jsonl`, `cache/`, `reports/<date>.md`, `latest.md`.
- `tests/visibility.test.ts`.
