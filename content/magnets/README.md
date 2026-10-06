# Free resource library (lead magnets)

Each file here is one gated resource: a checklist, worksheet, planner, template, kit, guide or email course.
The site builds a landing page at `/free/<slug>` (email opt-in) and the full resource at `/free/<slug>/view`
(printable, not indexed). Opt-ins go to `/api/subscribe` with `kind: "magnet"` (or `"course"`) and
`interest: "magnet:<slug>"`, and the CRM routes them by `tag` and `sequence`.

Follow `content/STYLE.md` for voice, banned phrases, figures and links. Every file stays `reviewed: false`
until the attorney approves it.

## Frontmatter

```yaml
---
title: "Guardian Selection Worksheet"            # 3 to 8 words, Title Case
promise: "Compare up to three possible guardians side by side and record why you chose."  # one sentence under the headline
description: "Meta description, 140 to 160 characters, plain and specific."
format: worksheet        # checklist | worksheet | planner | guide | template | kit | workbook | email-course
category: wills          # basics | wills | trusts | property | incapacity | family | tax | elder-care | administration | business
audience: "Parents of children under 18"
benefits:                # 3 or 4 short bullets for the landing page: what the reader can DO with it
  - "Score each candidate on the things parents say matter most"
  - "A one-page letter you can give the person you choose"
  - "Questions to settle with your co-parent before you sign"
pages: 6                 # approximate printed pages
tag: guardian_worksheet  # CRM magnet tag, snake_case, unique
sequence: B              # G for anything aimed at people after a death (grief sequence, never marketing); otherwise B
related:                 # 2 to 5 pages this resource should be linked from, as section/slug
  - guides/guardianship-for-minor-children
  - life-events/new-baby
reviewed: false
updated: "2026-10-06"
---
```

## Body

- Markdown, no H1. Start with a short "How to use this" paragraph, then `##` sections.
- Checklist items: `- [ ] item`. Fill-in prompts: `- **Label:** ______________________` (one per line).
  Tables are fine for comparisons and inventories (leave blank cells for the reader).
- Be substantive and original: concrete steps, real mechanics, examples, common mistakes. Aim for
  900 to 1,800 words (email courses: 5 lessons of 250 to 400 words).
- End with `## When to talk to an attorney` (3 to 6 bullets) and `## Next step` (one or two links:
  a guide, tool, checklist or `/plan-finder`).
- Email courses (`format: email-course`): one `## Day N: <email subject line>` section per lesson, each
  ending with a `**Today's task:**` line.
- Never claim a state's specific rule as universal; say "rules vary by state". No invented statistics.
  No fake urgency, no "you need", no promised outcomes. No em dashes.

## Existing pages you may link and list in `related`

Guides (/guides/...): beneficiary-designations, business-succession-planning, choosing-a-trustee, choosing-an-executor,
digital-assets-estate-planning, estate-and-inheritance-taxes, estate-planning-for-blended-families, funding-your-trust,
guardianship-for-minor-children, healthcare-directives-and-living-wills, how-probate-works, how-to-make-a-will,
irrevocable-trusts-explained, leaving-money-to-minors, medicaid-and-long-term-care-planning, powers-of-attorney,
revocable-living-trust-explained, settling-an-estate-step-by-step, special-needs-trusts,
transfer-on-death-and-payable-on-death, updating-your-estate-plan, what-happens-if-you-die-without-a-will,
what-is-estate-planning, what-makes-a-will-valid

Life events (/life-events/...): buying-a-home, caring-for-aging-parents, death-of-a-parent, divorce, getting-married,
moving-to-a-new-state, new-baby, retirement, serious-diagnosis, starting-a-business

Comparisons (/compare/...): beneficiary-designation-vs-will, executor-vs-trustee, joint-ownership-vs-trust,
living-will-vs-healthcare-power-of-attorney, online-will-vs-estate-attorney, pour-over-will-vs-simple-will,
power-of-attorney-vs-guardianship, probate-vs-non-probate-assets, revocable-vs-irrevocable-trust,
special-needs-trust-vs-able-account, transfer-on-death-deed-vs-trust, will-vs-trust

Checklists (/checklists/...): annual-estate-plan-review, asset-and-account-inventory, beneficiary-designation-audit,
choosing-a-guardian-worksheet, choosing-an-executor-worksheet, digital-assets-inventory,
documents-to-gather-before-your-consult, first-30-days-after-a-death, funeral-and-burial-wishes,
important-contacts-list, letter-of-instruction-outline, trust-funding-checklist

Tools (/tools/...): estate-tax-estimator, probate-cost-estimator, life-insurance-needs, guardian-fund-calculator,
medicaid-lookback-date, plan-readiness-assessment, executor-workload, plan-review-reminder
