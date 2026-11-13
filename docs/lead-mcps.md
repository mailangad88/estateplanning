# Lead-generation MCP servers

These MCP servers let a Claude session read the data that decides where leads come from: Search Console,
GA4, Microsoft Clarity, a full SEO crawl, AI-answer readiness checks, and Brevo email stats. They are all
in the root `.mcp.json`, pinned to exact versions. All of them are free. None of them can post anything
publicly, and every Google connection is read-only.

The research and ranking behind this list is in the project files at `research/lead-mcps.md`.

| Server (`.mcp.json` name) | Package | What it answers | Credentials | Cost |
| --- | --- | --- | --- | --- |
| `search-console` | `mcp-search-console@0.4.2` (AminForou/mcp-gsc, MIT) | Which Illinois searches show our pages, page-2 pages to push, indexing problems, URL inspection | Google service account | Free |
| `google-analytics` | `analytics-mcp@1.1.0` (official Google, Apache-2.0) | Which pages and sources turn into form fills and bookings; funnel and conversion reports | Google service account + `GOOGLE_CLOUD_PROJECT` | Free |
| `seo-audit` | `@houtini/seo-audit-console@1.0.5` (Apache-2.0) | Full crawl with about 143 checks, schema, cannibalisation, internal links, AI "agent readiness", passage scoring | Google service account; optional free `CRUX_API_KEY` | Free (paid tiers forced off, see below) |
| `clarity` | `@microsoft/clarity-mcp-server@2.0.1` (official Microsoft, MIT) | Rage clicks, dead clicks, scroll depth and drop-off on intake forms and `/book` | `CLARITY_API_TOKEN` | Free |
| `ai-seo` | `@automatelab/ai-seo-mcp@1.0.1` (MIT) | llms.txt checks, AI crawler access in robots.txt, schema audit, citation-worthiness and AI Overview scoring | None | Free |
| `brevo` | Brevo's hosted server `https://mcp.brevo.com/v1/anthropic/mcp` (not open source) | Contacts, lists, automations and campaign stats: which nurture emails lead to bookings | Brevo sign-in (OAuth) on first use | Free on every Brevo plan |

Already here before this change: `dataforseo` (keyword volumes and SERPs, paid per call with caps, see
`docs/dataforseo.md`) and `excalidraw` (diagrams).

## Safety settings, and why

- **Search Console is read-only.** `GSC_ALLOW_DESTRUCTIVE=false` keeps the add/delete site and delete
  sitemap tools refusing. Add the service account to Search Console as a **Restricted** user too, so Google
  itself rejects any write.
- **GA4 is read-only.** The server only writes when started with `--allow-write`, which we never pass. Add
  the service account as a **Viewer**.
- **No surprise spend from the SEO audit.** `seo-audit` can call DataForSEO and Majestic, but those calls
  would bypass the spend caps in `npm run seo`. Its `DATAFORSEO_*` and `MAJESTIC_API_KEY` are set to empty
  in `.mcp.json`, which switches those tiers off. Use the `dataforseo` server or `npm run seo` for paid data.
- **Brevo sends from our code, not from Claude.** The Brevo server can also send emails and edit
  campaigns. Use it to read stats and draft changes. Attorney-approved copy goes out only through the
  site's own sequences (`docs/crm-sequences.md`).
- **Nothing posts publicly.** Review replies, Business Profile posts and social posts stay out of these
  tools. They go through attorney review, per the Illinois advertising rules.
- Keys never go in the repo or in chat. The Google key file is written to a private temp file at launch and
  deleted when the server stops (`scripts/mcp/with-google-creds.sh`).

## Setup (Angad, one time)

### 1. Google service account (covers `search-console`, `google-analytics`, `seo-audit`)

1. Create a free Google Cloud project at https://console.cloud.google.com/projectcreate (any name, for
   example `ffp-analytics`). No billing account is needed for these APIs.
2. In **APIs & Services → Library**, turn on: **Google Search Console API**, **Google Analytics Data
   API**, **Google Analytics Admin API**. Optional: **Chrome UX Report API** (free real-user speed data).
3. In **IAM & Admin → Service Accounts**, create a service account (for example `claude-readonly`). Give it
   no project roles. Open it, go to **Keys → Add key → JSON**, and download the key file.
4. Search Console (https://search.google.com/search-console): open the familyfutureplanning.com property,
   **Settings → Users and permissions → Add user**, paste the service account's email, permission
   **Restricted**. If the property is not verified yet, verifying it needs a DNS TXT record in Cloudflare,
   which is a live-domain change.
5. GA4 (https://analytics.google.com): **Admin → Property access management → Add users**, paste the same
   email, role **Viewer**. Note the GA4 property ID while you are there.
6. Optional: in **APIs & Services → Credentials → Create credentials → API key**, restrict the key to the
   Chrome UX Report API. That is `CRUX_API_KEY`.

### 2. Microsoft Clarity (covers `clarity`)

1. Create a free project at https://clarity.microsoft.com for familyfutureplanning.com. Turn on masking of
   all form text (Settings → Masking → Strict) so no lead's details are recorded.
2. Add the Clarity tag to the site behind cookie consent. That is a small site change for the lead capture
   thread; until it ships, the server has no data to read.
3. **Settings → Data Export → Generate new API token**. That is `CLARITY_API_TOKEN`. Microsoft limits the
   export API to a few calls a day per project over the last 1 to 3 days, so use it for a daily check.

### 3. Brevo (covers `brevo`)

Nothing to set. The first time a session uses the `brevo` server, it opens a Brevo sign-in. It needs the
Brevo account from `docs/crm-sequences.md` to exist first.

### 4. Where the keys go

| Variable | Value | Local (`.env.local` or shell) | Claude cloud environment |
| --- | --- | --- | --- |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the JSON key file, kept outside the repo | Yes | No |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The whole JSON key file pasted as one value | Not needed | Yes |
| `GOOGLE_CLOUD_PROJECT` | The Google Cloud project ID | Yes | Yes |
| `CLARITY_API_TOKEN` | Clarity data export token | Yes | Yes |
| `CRUX_API_KEY` | Optional Chrome UX Report key | Optional | Optional |

Claude Code reads `.mcp.json` variables from the shell environment, so locally export them (or
`source .env.local`) before starting `claude`.

### 5. Allowed domains for Claude cloud sessions

The cloud environment's network policy currently blocks some of these. Add them to its allowed domains:

- `www.clarity.ms` (Clarity export API), blocked today
- `mcp.brevo.com` (Brevo MCP), blocked today
- `familyfutureplanning.com` and `www.familyfutureplanning.com` (so `seo-audit` and `ai-seo` can crawl the
  live site), blocked today
- `searchconsole.googleapis.com`, `analyticsdata.googleapis.com`, `analyticsadmin.googleapis.com`,
  `oauth2.googleapis.com`, `chromeuxreport.googleapis.com`: reachable today, listed in case the policy
  changes
- `pypi.org` and `files.pythonhosted.org` (uvx downloads the two Python servers) and `registry.npmjs.org`

## Checking a server works

In a Claude session, run `/mcp` to see each server's status. Good first questions:

- `search-console`: "List my Search Console properties, then show queries with impressions but position 8
  to 20 over the last 28 days."
- `google-analytics`: "Run a funnel report from landing page to `lead_capture` to `consult_booked` for the
  last 30 days."
- `seo-audit`: "Run `seo_audit_help`, then crawl familyfutureplanning.com and list the top 20 findings."
- `clarity`: "Which pages had the most rage clicks yesterday?"
- `ai-seo`: "Run `llms_txt_validate` and `check_robots` on familyfutureplanning.com."

Every server here was started and listed its tools on 2026-11-13 with no keys set (search-console 21
tools, google-analytics 10, seo-audit 65, clarity 3, ai-seo 20). Calls that need a key fail with a clear
message until the key is set.

## Considered, not installed

| Server | Why not now | What it would take |
| --- | --- | --- |
| reddit-mcp-buddy | Reddit closed new public API access on 2026-10-31, and anonymous RSS reads end 2026-11-13. There is no way to get credentials now. | Nothing to do unless Reddit reopens access. |
| citation-intelligence (AI citation tracker) | Costs about $0.20 to $0.60 a week in OpenAI/Anthropic/Perplexity API calls, and `npm run visibility` (`docs/ai-visibility.md`) already tracks citations. | Angad approves the spend and sets per-key caps in each API dashboard. |
| OpenGMB (Google Business Profile reviews and posts, with human approval) | Needs a small always-on server (Docker Compose, about $5 to $10 a month) and Google's Business Profile API approval, which needs a profile at least 60 days old. | 1. Verified GBP at least 60 days old. 2. Apply for GBP API access in Google Cloud. 3. Approve a VPS. 4. Then add it here with approval rules on. |
| Postiz (social scheduling for YouTube, Instagram, Facebook, Business Profile) | Needs a server with Postgres and Redis (about $5 to $10 a month) and our own developer app on each platform. Overlaps with the social video studio's own posting (`docs/social-studio.md`). | Only if the studio's per-platform publishing stalls. |
| google-ads-mcp (official) | Only useful once there is ad spend. Needs a Google Ads developer token. | Add read-only (`labels: false`, `assets: false`) when ads start. |
