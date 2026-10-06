# Daily landing page pipeline

This is how new search landing pages go from a keyword to a published, indexed page every day, without
tripping Google's scaled-content rules or the attorney advertising rules.

```
content/queue.json  ->  daily routine drafts 3-4 pages  ->  PR with tests green  ->  attorney review
     (keywords)          (templates + LEARN-STYLE.md)         (quality gate)          (review: approved)
                                                                                           |
            IndexNow ping  <-  sitemap, llms.txt, feed update  <-  merge to main  <--------+
```

## 1. The queue: `content/queue.json`

Every candidate page is an item:

| Field | Meaning |
|---|---|
| `id` | Stable ID (`K001`...) |
| `keyword` | The search phrase or question, as people type it |
| `intent` | `question`, `explainer`, `comparison`, `cost`, `situation`, `state-topic`, `local` |
| `cluster` | The library cluster (`content/topic-map.json`) the page belongs to |
| `priority` | 1 (do first) to 5 |
| `status` | `queued`, `drafted` (PR open), `published`, `covered` (an existing page answers it; see `coveredBy`), `blocked` (waits on something only the firm can supply), `skipped` |

The queue was seeded from the research keyword map (`scripts/seed-queue.py`). The first run produced
292 queued, 78 already covered and 15 blocked (state and local pages wait for the launch state).
Add new ideas from Search Console queries, People Also Ask and real client questions as new items.

```bash
node scripts/queue.mjs stats
node scripts/queue.mjs next 20          # what to write next, grouped by cluster
node scripts/queue.mjs claim trusts successor-trustee-first-steps "Successor trustee: your first 30 days" K342 K343
node scripts/queue.mjs mark covered K345 --by /learn/after-a-death/trust-administration
```

## 2. Templates: `content/templates/`

One template per intent says what sections, tables and examples the page needs. `content/LEARN-STYLE.md`
covers the format, voice, links and facts that apply to every page. Group closely related queue items into
one page. A question that needs only a paragraph becomes an FAQ on an existing page, and its item is marked
`covered`.

## 3. Quality gate (runs in CI on every PR)

`tests/content.test.ts` fails the build unless every page:

- exists in the topic map and links to its pillar, two or more other pages, and the plan finder or a free tool
- is not orphaned (another page links to it) and every link resolves
- meets the minimum length and has a title, a 150-160 character description, an answer box and 3+ FAQs
- has a unique title, description and FAQ questions
- shares no more than 15% of its 8-word phrases with any other page (catches templated near-duplicates)
- makes no restricted claims about the firm and no referral-model statements

`scripts/launch-check.mjs` (runs before every build) also blocks banned advertising words, and blocks
production deploys while placeholders remain.

## 4. Attorney review and the publish gate

Every new page is written with `review: pending`. The attorney reviews the PR (or the preview deploy) and
changes `review: pending` to `review: approved` on each page they sign off. Set
`REQUIRE_ATTORNEY_REVIEW=true` in production once reviews begin: from then on, pending pages still render for
review but are `noindex` and are left out of the sitemap, `llms.txt`, `llms-full.txt` and the RSS feed. Approved
pages show an "Attorney reviewed" badge.

## 5. Indexing on publish

- **Sitemap, llms.txt, llms-full.txt, RSS feed, /raw/*.md, /glossary.json, /faq.json** are generated at
  build time from the content, so they update automatically on every deploy.
- **IndexNow** (Bing, Yandex, Naver, Seznam and the AI search products that use their indexes):
  `.github/workflows/indexnow.yml` runs `scripts/indexnow.mjs` after content lands on `main`, submitting the
  changed URLs. It needs a repository secret `INDEXNOW_KEY` (any 32 hex characters), the same value as the
  `INDEXNOW_KEY` environment variable on the host (served at `/indexnow-key.txt`), and a repository variable
  `SITE_URL`.
- **Google** does not use IndexNow. Submit `https://<domain>/sitemap.xml` once in Search Console. Google
  rereads it and uses each URL's `lastmod`. For an urgent page, use Search Console's URL inspection, then
  "Request indexing".

## 6. The daily routine

A scheduled Claude routine runs once a day. It:

1. pulls `main`, runs `node scripts/queue.mjs next 30`, and picks 3 to 4 pages' worth of related items
   (highest priority first, no more than 2 pages per cluster per day)
2. checks the existing library for overlap, marks items `covered` or folds them into FAQs where a full page
   isn't warranted
3. claims the rest with `scripts/queue.mjs claim`, then writes each page from its template
4. links each new page from its pillar and one sibling article
5. runs `npm run typecheck`, `npm test` and `npm run build` and fixes anything red
6. opens a PR titled `Daily pages: <date>` listing the pages, their keywords and any facts the attorney
   should check

Nothing publishes without a human merge, and nothing is indexed in production without `review: approved`.

### Why 3 to 4 pages a day, not 50

Google's spam policies treat mass-produced pages made mainly to rank as "scaled content abuse", whoever or
whatever writes them, and legal pages are held to the highest quality bar ("your money or your life").
A few pages a day that each answer something no other page answers, reviewed by the attorney, compound
into authority. Hundreds of thin pages get a site demoted as a whole. Raise the daily count only when
reviews keep up and Search Console shows the new pages being indexed and earning impressions.
