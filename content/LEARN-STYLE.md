# Content guide

Every page in `content/` is written for a real person who is worried about their family, and for search
engines and AI answer engines that quote pages they trust. Those goals point the same way: answer the
question plainly and early, then go deep, be specific, be accurate, and link to the next thing a reader needs.

All content is general education from a law firm's marketing site. It is **pending attorney review** and is
not legal advice. The firm is the publisher. Do not mention referrals, networks, matching, partner attorneys,
or fees being shared. Say "our attorneys" or "an estate planning attorney".

## File format

Markdown with YAML frontmatter. Pillars are `content/learn/{cluster}/index.md`; articles are
`content/learn/{cluster}/{slug}.md`. The slug and title come from `content/topic-map.json` (you may polish the
title wording, but keep the slug exactly).

```yaml
---
title: "What happens if you die without a will (intestate succession)"
description: "150-160 characters. A specific, plain summary that makes someone want to click. No clickbait."
updated: "2026-10-06"
answer: >-
  40-70 words. A direct, self-contained answer to the title's question that an AI assistant or featured
  snippet could quote word for word. Start with the answer, not a preamble. No "it depends" without saying on what.
takeaways:
  - "3-5 short key takeaways, each a complete sentence."
faqs:
  - q: "A real question people search for, phrased the way they type it?"
    a: "A 2-4 sentence answer that stands on its own."
  # 4-6 FAQs. Do not repeat the same question on another page.
related:
  - "wills/choosing-an-executor"   # 3-6 cluster/slug references (pillar is "cluster" alone, e.g. "probate")
glossary: ["intestate", "heir"]     # 2-8 glossary slugs from content/glossary-terms.json used on this page
review: pending                    # only the attorney changes this to approved
intent: question                   # landing page pipeline intent (content/templates), optional
---
```

## Body

- No H1 in the body (the title is the H1). Use `##` for sections and `###` for subsections.
- Articles: 1,200 to 2,000 words. Pillars: 2,000 to 3,000 words and they must link to **every** article in
  their cluster with a sentence explaining what it covers, plus link to 3+ other pillars.
- Open with 1-2 short paragraphs that restate the reader's situation and what they will learn. Then the meat.
- Use question-shaped `##` headings where natural ("How long does probate take?"), because people and AI
  assistants search in questions. Put the direct answer in the first sentence under each heading.
- Include at least one of: a numbered step list, a comparison table (Markdown table), or a checklist.
- Use concrete, realistic examples with invented first names ("Maria, 58, owns a house and a 401(k)...").
- Explain where state law differs ("In most states...", "Some states, including X and Y, ..."). Only name a
  specific state's rule when you are confident it is right; otherwise describe the variation generally.
- End with a `## How we can help` section of 2-4 sentences that invites the reader to use the
  [plan finder](/plan-finder) or book a consultation. Calm, no pressure, no urgency tricks, no guarantees.

## Links (this is what makes the site an interlinked engine)

- 5-12 internal links per article, written inline where they help the reader, using descriptive anchor text
  (never "click here"). Link format is root-relative:
  - Pillar: `/learn/{cluster}`; article: `/learn/{cluster}/{slug}`
  - Glossary: `/glossary/{slug}` (only slugs in `content/glossary-terms.json`)
  - State guides: `/estate-planning/{state-slug}` e.g. `/estate-planning/texas` (lowercase, hyphenated name)
  - Plan finder: `/plan-finder`
- Always link the article's own pillar at least once, and at least 2 articles in other clusters.
- Only link slugs that exist in `content/topic-map.json`. A test fails the build on any broken link.
- No external links except to primary government sources when genuinely useful (irs.gov, ssa.gov,
  medicaid.gov, a state legislature or court site). No links to competitors or other law firms.

## Facts to keep consistent across the site

- Federal estate and gift tax basic exclusion: **$15,000,000 per person in 2026** (set by the 2025 tax law,
  indexed for inflation after 2026; no scheduled sunset). Married couples can shelter $30 million with portability.
- Gift tax annual exclusion: **$19,000 per recipient in 2026**.
- Top federal estate tax rate: 40%.
- Inherited IRAs: most non-spouse beneficiaries must empty the account within 10 years (SECURE Act); eligible
  designated beneficiaries (surviving spouse, minor child of the owner until majority, disabled or chronically
  ill person, someone not more than 10 years younger) have other options.
- Medicaid long-term care look-back: 60 months in nearly all states (California's is being phased in differently; say "most states").
- Step-up in basis applies to most inherited assets at death; it does not apply to lifetime gifts.
- Say "currently" or "as of 2026" for any number that changes.

## Voice

- Plain English, eighth-grade reading level, short paragraphs, second person ("you").
- Warm and steady. Never alarmist, never salesy. No "In today's fast-paced world", "navigating the complex
  landscape", "it's important to note", "delve", "crucial", "peace of mind" more than once, or ending summaries
  that repeat the article. No exclamation marks.
- Specific beats general: name the form, the account type, the deadline type, the person who signs.
- Never promise outcomes ("avoid all taxes", "guaranteed"), never call the firm "the best" or "experts"
  or "specialists" (bar rules restrict these words). Use "focus on" instead.
- Every page must be original. Do not reuse paragraphs between pages; if two pages touch the same idea,
  explain it briefly and link to the page that owns it.
