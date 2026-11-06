# Search and AI visibility: what the site does, and what Angad clicks

Last updated 2026-10-31. Everything here is free unless marked. Nothing in this list touches the live domain
until launch day; do the "after go-live" steps only once familyfutureplanning.com is serving the site.

## What the code already does

| Area | Where | Status |
|---|---|---|
| Sitemap index split by page type (articles, states, tools, videos) with lastmod | `src/lib/sitemaps.ts`, `/sitemap.xml` | Done |
| robots.txt: every major AI crawler named and allowed (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended, Bingbot, Amazonbot and more); private areas blocked | `src/app/robots.ts` | Done, `/admin`, `/client`, `/unsubscribe` added in this PR |
| Staging and `*.vercel.app` copies are noindexed so only the domain ranks | `next.config.ts`, `src/lib/env.ts` | Done |
| www to apex 301 | `next.config.ts` | Done |
| llms.txt and llms-full.txt, `/raw/...md` copies, `/faq.json`, `/glossary.json` | `src/app/llms*.txt` | Done, rewritten in this PR to say "referral network for Illinois and New Jersey" with a key-facts block |
| Structured data: Organization + LegalService, Attorney/Person, WebSite, Article, FAQPage, BreadcrumbList, HowTo, VideoObject, DefinedTerm, Service, City/State pages, Speakable | `src/lib/seo.tsx`, `src/lib/schema.ts` | Done; `areaServed` now lists Illinois and New Jersey as State objects |
| IndexNow (Bing, Yandex, Seznam, Naver; Bing feeds ChatGPT search and Copilot) | `scripts/indexnow.mjs`, `.github/workflows/indexnow.yml` | Done; this PR adds `--all` for a one-time launch-day push of every URL |
| Pages pending attorney review are noindexed when `REQUIRE_ATTORNEY_REVIEW=true` | `src/lib/library.ts` | Done |
| Google Tag Manager with Consent Mode v2, event filter that strips sensitive data | `src/components/Analytics.tsx`, `src/lib/analytics.ts` | Done, waits for `NEXT_PUBLIC_GTM_ID` |
| Conversion events: `lead_capture`, `consult_booked`, `cta_book`, `click_to_call`, `click_to_text`, `tool_complete`, `plan_finder_result` | `src/components/capture.tsx` and tools | Done |
| Lead attribution: landing page, referrer, UTMs, gclid, fbclid, "How did you hear about us?" saved on every lead | `src/lib/visitor.ts`, `src/lib/lead.ts` | Done |

## What this PR adds

- **Search Console, Bing and Yandex verification tags** from env (`GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `YANDEX_VERIFICATION`). Only needed if DNS verification is not used. Never rendered on staging.
- **Cloudflare Web Analytics** (free, no cookies, so it counts every visitor, unlike GA4 which only counts people who accept cookies). Set `NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN`.
- **Core Web Vitals from real visitors** sent to the dataLayer as `web_vitals` (LCP, INP, CLS, FCP, TTFB), so GA4 shows slow templates within a day instead of waiting for Search Console's 28-day report.
- **Lead channel on every CRM record**: `channel` (organic_search, ai_assistant, paid_search, social, email, partner, referral, direct) and `channel_engine` (google, bing, chatgpt, perplexity, claude, gemini, copilot...). This answers "how many consults came from Google vs ChatGPT" straight from the CRM.
- **A real 404 page** with search, the five most useful pages and a Book button, instead of the bare default. Noindexed.
- **llms.txt rewrite**: no "[Firm legal name]" placeholder, says what the site is (referral network), the states, packages, how to book, and the disclaimer.
- **IndexNow `--all`** for launch day.

## Angad's click list

### Before launch (can do now, no live-domain change)

1. **Cloudflare Web Analytics** (free). Cloudflare dashboard > Analytics & Logs > Web Analytics > Add a site > enter `familyfutureplanning.com` > choose the JavaScript snippet option > copy only the `token` value. In Vercel, live project > Settings > Environment Variables > add `NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN` (Production). It starts counting at launch.
2. **GA4 + Tag Manager** (free). analytics.google.com > Admin > Create property "Family Future Planning" > Web stream for `https://familyfutureplanning.com` > copy the Measurement ID (G-...). tagmanager.google.com > Create account > Container "familyfutureplanning.com" (Web) > copy the GTM-... id. In GTM: add a "Google tag" with the G- id on All Pages, and a "GA4 Event" tag with event name `{{Event}}` fired on a Custom Event trigger matching `lead_capture|consult_booked|cta_book|click_to_call|click_to_text|tool_complete|web_vitals` (regex). Publish. In Vercel add `NEXT_PUBLIC_GTM_ID`. In GA4 > Admin > Events, mark `lead_capture`, `consult_booked` and `click_to_call` as **Key events**.
3. **IndexNow key.** Generate one: any 32 random hex characters (Claude can make one). Vercel live project env `INDEXNOW_KEY`. GitHub repo > Settings > Secrets and variables > Actions > New secret `INDEXNOW_KEY` (same value) and Variables > `SITE_URL` = `https://familyfutureplanning.com`.
4. **Set `REQUIRE_ATTORNEY_REVIEW=true`** on the live project so unreviewed drafts are noindexed.

### Launch day (after the domain serves the site)

5. **Google Search Console.** search.google.com/search-console > Add property > **Domain** > `familyfutureplanning.com` > copy the TXT record. Cloudflare > DNS > Records > Add record > Type TXT, Name `@`, Content = the value > Save. Back in Search Console click Verify (can take a few minutes). Then Sitemaps > enter `sitemap.xml` > Submit. Then URL Inspection > paste the home page, `/book`, `/pricing`, `/estate-planning/illinois`, `/estate-planning/new-jersey` > Request indexing for each.
6. **Link Search Console to GA4.** GA4 > Admin > Product links > Search Console links > Link > pick the property and web stream. This puts search queries next to conversions.
7. **Bing Webmaster Tools.** bing.com/webmasters > Sign in > **Import from Google Search Console** (one click, copies the verified site and sitemap). Bing feeds ChatGPT search, Copilot and DuckDuckGo, so this matters for AI answers.
8. **IndexNow launch push.** Ask Claude to run `node scripts/indexnow.mjs --all` with the key, or run it locally with `SITE_URL` and `INDEXNOW_KEY` set.
9. **Check robots and llms.txt load**: `https://familyfutureplanning.com/robots.txt`, `/llms.txt`, `/sitemap.xml`. Run the home page and `/learn/wills` through search.google.com/test/rich-results.

### Week one

- **Add the visibility tracker keys** (`docs/ai-visibility.md`): Search Console service account and Bing Webmaster API key are free; DataForSEO is already set up; Perplexity, Gemini, Claude and OpenAI keys are optional at a few dollars a month.

10. **PageSpeed check**: pagespeed.web.dev on home, a long article, `/book` and a calculator. Anything under 90 on mobile goes back to Claude.
11. **Search Console > Pages**: anything "Discovered, not indexed" or "Crawled, not indexed" after two weeks goes to the SEO thread.

## Google Business Profile: read this first

Google's rules do not allow a Business Profile for a lead-generation or referral service. A profile for
Family Future Planning risks suspension. The profile that can rank in the map pack is **the attorney's own
practice** (Sargun Singh's firm at a real office address in Illinois or New Jersey, staffed during listed
hours). Recommended:

- Sargun creates or claims the firm's profile at business.google.com: category "Estate planning attorney", secondary "Probate lawyer", service areas, hours, phone, and the website link `https://familyfutureplanning.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp` (UTMs let the CRM count map-pack leads).
- Add the profile URL to `firm.attorneySameAs` in `src/config/firm.ts` so structured data links the attorney to it.
- Same for **Bing Places** (import from Google) and **Apple Business Connect** (free).

## Reviews and citations plan (free)

Attorney advertising rules in Illinois (RPC 7.1) and New Jersey (RPC 7.1, which also restricts comparisons and
requires care with testimonials) apply. Sargun signs off before any review appears on the site.

1. **Attorney profiles** (free, high authority, often cited by AI answers): Avvo, Justia Lawyer Directory, FindLaw (free basic), Martindale-Hubbell / Lawyers.com, the Illinois State Bar and NJ State Bar member directories, Chicago Bar Association lawyer finder, county bar directories. Each links to the site. Add each URL to `firm.attorneySameAs`.
2. **Brand profiles** for the referral site: LinkedIn company page, YouTube channel (already planned by the video studio), Facebook page, Crunchbase. Add to `firm.sameAs`.
3. **Review ask**: after a retainer is signed and the work delivered, the nurture sender emails one ask for a Google review on the attorney's profile. No incentives, no review gating (asking only happy clients is against Google's rules).
4. **Consistent name, address, phone** everywhere: the same text as on the site.

## AI answer visibility (GEO/AEO)

- Bing indexing (step 7) and IndexNow are the main levers for ChatGPT search and Copilot. Google indexing drives Gemini and AI Overviews. Perplexity and Claude crawl on their own; robots.txt already welcomes them.
- Every page leads with a short direct answer, has FAQ schema and a named reviewing attorney once approved. The biggest single blocker today: **no page has attorney approval yet**, so with `REQUIRE_ATTORNEY_REVIEW=true` almost nothing gets indexed. Sargun's review queue at `/admin/reviews` is the gate.
- Track it: the CRM's `channel = ai_assistant` count, Cloudflare/GA4 referrers from chatgpt.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com, and the "How did you hear about us?" answer.
- **Weekly rank and citation tracker**: `npm run visibility` checks the money keywords and questions in Google (rank + AI Overview + AI Mode), Bing, ChatGPT, Perplexity, Gemini, Claude and Brave, plus free Search Console and Bing Webmaster data, and lists fixes per query. Runs weekly in GitHub Actions once the keys are added as repository secrets. Costs about $6 a month with every engine on, capped. See `docs/ai-visibility.md` for which keys to add.
- Paid AI visibility SaaS (Profound, Otterly, Peec) is not needed; the tracker covers it.

## Costs

All of the above is $0 except the domain you already bought. Optional later: Plausible ($9/month) if you
want a nicer dashboard than Cloudflare's, Google Ads (pay per click).
