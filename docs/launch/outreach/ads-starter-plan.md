# Paid ads starter plan (approve or skip)

Nothing here is switched on. No accounts were created and no money was spent. Every option needs Angad's typed OK and the gates in `launch-week-outreach.md` section 1.

## The choice

| Option | Google Search | Meta (Facebook + Instagram) | Total per month | When |
|---|---|---|---|---|
| A. Skip | $0 | $0 | $0 | Default for launch week |
| B. Small test (recommended) | $200 ($6.50/day cap) | $100 ($3.30/day cap) | about $300 | From Day 8, after two real leads have flowed end to end |
| C. Learn faster | $400 ($13/day cap) | $200 ($6.50/day cap) | about $600 | Only if B books at least one consult in its first 2 weeks |

Stop rule: if a channel spends $150 with zero consult requests, pause it and look at the search terms or the creative before spending more.

Why so small: Chicago estate planning clicks are expensive. The earlier research in `research/paid-ads-strategy.md` estimated around $20 a click on broad terms, and that a real Google Search test for one practice area usually takes $3,000 to $5,000 a month. A $300 test will not prove the channel. It will show whether narrow urgent searches convert on this site and what they cost, for very little money. Treat every number below as an estimate until the accounts show real costs.

## Prerequisites (all free)

1. GA4 and Google Tag Manager live (`NEXT_PUBLIC_GTM_ID`), with `generate_lead` and `schedule_consult` marked as key events.
2. Google Ads conversion imported from GA4 (or the Google Ads tag through GTM). Meta Pixel installed through GTM, with the cookie banner respected.
3. Real phone on the site. Optional: a separate tracking number for ads (`trackingNumbers` in firm.ts).
4. Sargun's OK on the ad copy below and on the referral structure question (gate 5).
5. A monthly account-level spending limit set in both platforms, not just daily budgets.

## Google Search

**Campaign:** "IL urgent estate", Search only (turn off Display and Search Partners), location: Illinois, "presence: people in or regularly in" (not "interest in"). Language English. Schedule: all days, 7am to 10pm Central. Bidding: Maximize clicks with a $6 max CPC cap for the first two weeks, then Maximize conversions once there are 10+ conversions.

**Ad groups and keywords** (phrase match and exact match only, no broad match at this budget):

1. Probate without a will / house in a parent's name
   - "small estate affidavit illinois"
   - "illinois small estate affidavit"
   - "house in deceased parents name illinois"
   - "heirship affidavit illinois"
   - "cook county probate"
   - "how to probate a will in illinois"
   - Landing page: `/free/illinois-small-estate-affidavit-guide` or `/free/cook-county-probate-guide`, with booking (`/book?topic=probate&from=gads-probate`) on the page
2. Will or trust, with price intent
   - "estate planning attorney cost illinois"
   - "living trust cost illinois"
   - "how much does a will cost in illinois"
   - "flat fee estate planning chicago"
   - Landing page: `/pricing`
3. Power of attorney for a parent
   - "power of attorney for elderly parent illinois"
   - "illinois power of attorney for health care"
   - Landing page: `/free/illinois-health-care-poa-guide`

**Negative keywords (account level):** free, form, template, pdf, diy, download, job, jobs, salary, paralegal, school, course, definition, meaning, personal injury, accident, car accident, divorce, criminal, dui, immigration, bankruptcy, new jersey, nj, wisconsin, indiana, iowa, missouri, texas, california, florida, legalzoom, rocket lawyer, trust and will, nolo.

(Searchers wanting a free form can still find the free tools organically. Excluding them from paid clicks keeps the budget on people likely to book.)

**Responsive search ad (Ad group 2), headlines** (30 characters max each):
- Illinois Estate Plans, Flat Fee
- Wills From $2,500 Flat
- Living Trust Plans $3,500
- Prices Posted Before You Call
- Matched With an IL Attorney
- One Price for You or a Couple
- Free Will-or-Trust Picker
- Book a Time Online

**Descriptions** (90 characters max):
- Flat-fee Illinois estate plans. See every price first, then book a time with an attorney.
- Wills, trusts and powers of attorney for Illinois families. One revision round included.
- Referral service matching Illinois residents with an estate attorney. Attorney advertising.

**Ad group 1 headlines:** Small Estate Affidavit Guide / When You Can Skip Probate / Free Illinois Probate Checklist / Cook County Probate, Explained / Talk to an Illinois Attorney.

Do not use "best", "top", "expert", "specialist", "free consultation" (not approved), or any response time.

**Extensions:** sitelinks to /pricing, /tools/who-inherits, /free/illinois-probate-checklist, /book. Call extension only after the real phone is live. Location extension only after the Google Business Profile is verified.

## Meta (Facebook and Instagram)

Goal at this budget: email signups for free Illinois resources (cheaper than consult requests) that the nurture sequence warms up, plus a small retargeting audience.

**Campaign:** objective Leads, conversion location Website, optimizing for the `Lead` event fired by the resource form. Location: Illinois (people living in). Age 30 to 70. Advantage+ audience on, no detailed targeting by health, age-related conditions or financial status (Meta restricts these, and they are sensitive).

**Ad 1, parents of young kids** (image: guardian picker result card)
> Primary text: If you both died tomorrow, who would raise your kids? In Illinois, a judge decides if your will doesn't say. Our free guardian guide walks you through choosing someone, in about 10 minutes.
> Headline: Free Illinois guardian guide
> Link: /free/illinois-guardianship-for-minors-guide?utm_source=facebook&utm_medium=paid_social&utm_campaign=guardian

**Ad 2, adult children of aging parents** (image: "three papers" checklist)
> Primary text: Helping a parent with bills or doctor visits? The three papers to find now: power of attorney for property, power of attorney for health care, and a living will. Free Illinois guide.
> Headline: Three papers to find before a crisis
> Link: /free/illinois-health-care-poa-guide?utm_source=facebook&utm_medium=paid_social&utm_campaign=parent-poa

**Ad 3, everyone** (image: pricing cards)
> Primary text: Illinois estate plans at a flat price you can see before you call. Wills plan $2,500. Living trust plan $3,500. One price for one person or a couple.
> Headline: Prices posted up front
> Link: /pricing?utm_source=facebook&utm_medium=paid_social&utm_campaign=pricing

Every ad's text or image carries: "Referral service. Educational only, not legal advice. Attorney advertising. Responsible attorney: Sargun Singh, [office city], IL."

**Retargeting (Option C only):** website visitors last 30 days, excluding people who already booked, Ad 3 only, $2/day.

Never run ads aimed at people who just lost someone. Probate content stays organic and search.

## Microsoft Ads (optional, later)

Bing clicks are often cheaper for older audiences. Import the Google campaign once it has 30 days of data; same caps.

## What to look at each week

- Search terms report: add negatives for anything off-topic.
- Cost per consult request by ad group.
- Landing page: did people who clicked book, start a tool, or leave in under 10 seconds?
- Meta: cost per email signup and how many of those signups later booked (needs the CRM source field).
