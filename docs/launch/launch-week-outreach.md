# Launch week and first 30 days: outreach and promotion plan

Family Future Planning (familyfutureplanning.com). Illinois only. Written 2026-11-06 for a weekend launch.

Everything here is a draft. Nothing has been sent, posted, booked or paid for. Each asset needs Sargun's review before it goes out, and every paid line is an option Angad can approve or skip.

## Files in this folder

| File | What it is |
|---|---|
| `launch-week-outreach.md` | This plan: gates, day-by-day launch week, days 8 to 30, budget choices, what to measure, what Angad still owes |
| `outreach/announcement-emails.md` | Launch emails and texts for your own network, a LinkedIn note, two follow-ups, a newsletter for opt-in subscribers |
| `outreach/social-posts.md` | Launch posts for Instagram, Facebook, LinkedIn, YouTube, Nextdoor, plus Reddit and Facebook-group guidance |
| `outreach/posting-calendar.csv` | One row per post for Nov 7 to Dec 6: date, platform, asset, caption, tracked link |
| `outreach/partner-targets.csv` | Who to approach (CPAs, advisors, realtors, senior living, funeral homes, community venues), where to find them, how many, which script |
| `outreach/partner-scripts.md` | Partner emails, call and voicemail scripts, a library-talk pitch, thank-you notes, all rewritten for the referral model |
| `outreach/free-resource-promotion.md` | The 14 free Illinois resources and tools to push first, with the angle and the link for each |
| `outreach/ads-starter-plan.md` | Google Search and Meta starter plans at $0, about $300 and about $600 a month, keywords, negatives, ad copy |

Older research these build on, already in the project folder: `research/partner-kit/` (per-partner kits and compliance rules), `research/partner-outreach-playbook.md`, `research/paid-ads-strategy.md`, `research/gbp-posts-and-reviews.md`, `research/client-pain-points/`, and the 30-short calendar in `content/social/calendar.json` (PR #76).

## 1. Gates: do not promote until these are true

Promotion sends people to the site. If the phone is a placeholder or a form goes nowhere, every share burns a warm contact. These are pass or fail.

1. **The site is live on familyfutureplanning.com** with `SERVED_STATES=IL` and no placeholders (`LAUNCH_CHECK=strict npm run launch-check` passes). See `launch/go-live-familyfutureplanning.md`.
2. **A test lead reaches Sargun.** Submit the /book form and the call-back form from a phone on the live domain. Confirm it lands in the lead store (Neon) and that Sargun gets the alert. Do it twice.
3. **Real contact facts are on the site**: business legal name, phone, hello@ email that receives mail, mailing address, hours. Illinois Rule 7.2 expects ads to name a responsible lawyer and an office address, so posts and ads also need these.
4. **Sargun has approved** the pricing page, /book, and the first week of posts in this folder. Write his OK down with the date.
5. **The open referral-structure question has an answer.** Illinois Rule 7.2(c) to (f) covers intermediary "connecting" services. Memory notes this was flagged on 2026-10-26 and not yet settled. Sargun (or an ethics hotline call to the ISBA) should confirm the site's model before paid ads run. Organic posts to your own network are lower risk but carry the same disclaimer.
6. **Shorts and cards ready.** The daily shorts link to `/tips/<slug>` pages, which arrive with PR #76; merge it before the first short goes out, or point the links at the matching /free page. **Old brand fixed in social media files.** The rendered cards and shorts in `media/social/` (188 caption files and the PNGs) and `video/src/config.json` still say `familyplanlaw.com`. Re-render before posting any of them. The new tip shorts from PR #76 point at `/tips` on the correct brand.
7. **Analytics on.** `NEXT_PUBLIC_GTM_ID` set, GA4 receiving `generate_lead` and `schedule_consult`. Without this, you cannot tell which channel worked.

If gates 1 to 4 are not done by Saturday, move Day 1 to the day they are. Everything below is written as Day 1, Day 2 and so on, with the calendar dates assuming Day 1 is Saturday, November 7.

## 2. What we are selling, in one paragraph

Illinois families get matched with an Illinois estate planning attorney, with flat prices posted before anyone calls: Essentials $2,500 (wills, powers of attorney, health care documents), Complete $3,500 (living trust plan with the home deeded in), Legacy quoted. One revision round is included. The site gives away the hard parts for free first: Illinois checklists, a who-inherits tool, a probate cost estimator, a will-or-trust picker. Booking is the main action: `/book`.

Things we do not say, because they are not approved or not true: "free consultation", any response time, "best", "top", "expert", "specialist", outcome promises, anything about New Jersey help, anything about personal injury, anything from Sargun's other firm.

## 3. Launch week, day by day

Hours are a rough estimate for Angad's time.

| Day | Date | Do | Hours |
|---|---|---|---|
| 0 | Fri Nov 6 | Run the gates above. Fill firm facts. Create the Cal.com event. Set up hello@ email. Ask Sargun to read `outreach/social-posts.md` launch posts and `announcement-emails.md` A and B. | 3 |
| 1 | Sat Nov 7 | Site goes live. Test leads (gate 2). Submit sitemap in Google Search Console and Bing Webmaster Tools. Create the Google Business Profile as a service-area business (hide the address if it is a home office). Post the personal launch post on your own Facebook and LinkedIn (post P1). Text 15 to 20 close friends and family asking for feedback, not business (Text T1). | 3 |
| 2 | Sun Nov 8 | Create or finish brand pages: Instagram professional, Facebook page, LinkedIn company page, YouTube channel, Nextdoor business page. Same name, same logo, same link. Post the brand launch post (B1) and the first short (v01 "The house is still in Mom's name"). | 2 |
| 3 | Mon Nov 9 | Send Email A to your wider personal list, 20 to 30 at a time, from your own inbox, one by one with a personal first line. Reply to every answer the same day. Post B2 (prices up front). Claim free listings: Bing Places, Apple Business Connect. | 2 |
| 4 | Tue Nov 10 | Partner outreach batch 1: 10 CPAs (November into mid-December is a good window for them). Use `partner-scripts.md` CPA email. Log each in `research/partner-kit/partner-tracker-template.csv`. Post v02. | 2 |
| 5 | Wed Nov 11 | Veterans Day post (B3). Partner batch 2: 10 financial advisors. Post on Nextdoor business page (N1). | 2 |
| 6 | Thu Nov 12 | Partner batch 3: 8 senior living communities and home care agencies. Send 3 library or senior center talk pitches. Post v03. Ask the 5 warmest friends from Day 1 for a Google review only if they actually used the site or booked (never for non-clients' "support" reviews). | 2 |
| 7 | Fri Nov 13 | Week 1 review (section 6). Decide on ads (section 5). Follow up Email A non-repliers once with Email A2. Post v04. | 1.5 |

Daily, all week: answer every comment and DM within the day, and log every lead's source.

## 4. Days 8 to 30 (Nov 14 to Dec 6)

One theme per week, tied to what families are already thinking about in late November.

**Week 2, Nov 14 to 20: caring for a parent.** November is National Family Caregivers Month. Push the dementia/power of attorney and Medicaid content, the Illinois Medicaid long-term care guide, and the health care POA guide. Partner focus: senior living, home care, geriatric care managers, plus the second touch to week-1 CPAs and advisors. Pitch one local paper or patch.com community section with the "talk to your parents this Thanksgiving" angle (`partner-scripts.md`, section 7).

**Week 3, Nov 21 to 27: the Thanksgiving conversation.** Families are together. Post "five questions to ask your parents" (B6), the who-inherits tool, the Illinois intestacy chart. Lighter partner outreach (holiday week). Thanksgiving Day itself: one gentle post, no selling.

**Week 4 and the start of December, Nov 28 to Dec 6: year-end review.** Beneficiary forms, guardians for young kids, Giving Tuesday (Dec 1) with charitable bequests and leaving money to a cause. Partner focus: realtors and funeral homes (touch 1), CPAs touch 3. Send the first monthly newsletter (Email C) to people who opted in through a free resource.

Every week:
- 1 short a day on Instagram Reels, Facebook Reels and YouTube Shorts from the PR #76 calendar, in order (v01 to v30), once Sargun approves each batch. The calendar CSV has them placed.
- 2 Google Business Profile posts (`research/gbp-posts-and-reviews.md` has drafts).
- 1 LinkedIn post aimed at professionals who might refer.
- 15 to 25 partner touches, logged.
- Answer 3 to 5 real Illinois questions where people ask them (section 2 of `social-posts.md`), with no link unless the community allows it.

## 5. Paid ads: Angad's call

Full detail in `outreach/ads-starter-plan.md`. The short version:

| Option | Monthly spend | What you get | Recommendation |
|---|---|---|---|
| A. Skip for now | $0 | Organic, partners, network only | Fine for week 1. |
| B. Small test | about $300 ($200 Google Search, $100 Meta) | Roughly 10 to 20 search clicks and a few thousand Meta views. Learning, not volume. | **Recommended from Day 8**, only after gates 1 to 7 pass and two real leads have flowed end to end. |
| C. Learn faster | about $600 ($400 Google, $200 Meta) | Enough clicks in 30 days to judge which keywords book calls | Only if B shows bookings in its first two weeks. |

Estate planning clicks in the Chicago market are expensive. The older research estimated around $20 a click for broad terms, so a $10-a-day budget buys very few broad clicks. The plan aims at narrow, urgent Illinois phrases (small estate affidavit, house in a deceased parent's name, Cook County probate) and promotes free resources on Meta, where the cost is a cheaper email signup rather than a call. Set daily caps in each platform and a monthly account cap. Nothing in this folder turns ads on.

Google Local Services Ads are the cheapest lead source for many law firms, but they verify a licensed attorney and a law business. A referral site may not qualify. Ask Google before counting on it.

## 6. What to measure, and a weekly 20-minute review

Track by the `from=` value on `/book` links and UTM tags on every shared link (the calendar CSV builds them for you; on brand posts, change `utm_source=social` to the actual platform, such as `instagram` or `facebook`, when you post).

| Measure | Where | Week 1 rough target | Day 30 rough target |
|---|---|---|---|
| Consult requests (/book + call-back) | lead store / Cal.com | 2 to 5 | 10 to 20 |
| Consults held | Sargun | 1 to 3 | 6 to 12 |
| Signed clients | Sargun | 0 to 1 | 2 to 5 |
| Free resource signups | CRM / Brevo | 10 to 30 | 60 to 150 |
| Partner conversations (a reply or a call, not a send) | tracker | 3 | 15 |
| Google reviews from real clients | GBP | 0 | 2 to 5 |
| Search Console impressions | GSC | a few hundred | a few thousand |

These are guesses for a brand-new domain with no paid traffic, not forecasts. Organic search takes months to build on a new domain, so in the first 30 days the network, partners and small ads carry the load.

Weekly review questions: Which `from=` source booked? Which post got saves or shares? Which partner replied? What did people ask on calls that the site does not answer yet? Feed the last one to the content thread.

## 7. Rules for everything in this folder

- Illinois only. No promise of help in New Jersey or any other state.
- Every public post, email and ad carries the short disclaimer: "Educational only, not legal advice. Referral service. Attorney advertising." Ads and targeted mail also name the responsible attorney and an office city.
- Targeted emails to someone you know needs legal help right now: "Advertising Material" at the start and the end (Illinois Rule 7.3(c)). The announcement emails mark where this applies.
- No payment, gift or favor for a referral, in either direction. Token holiday gifts only, logged, never tied to a referral. Partners are told every referred client is informed. Details: `research/partner-kit/README.md`.
- Grief contacts (someone who just lost a person) get help and resources, never a sales sequence. Funeral home material is aftercare information only.
- No fake reviews, no reviews from friends who did not use the service, no reviews in exchange for anything.
- No offer the attorney has not approved: no "free call", no response time, no discounts.
- Angad gates copy through Pangram. The drafts here are written to be edited in your own voice; change wording freely, keep the facts and the disclaimers.

## 8. What Angad still has to do (cannot be done from here)

In order:

1. Fill the remaining firm facts in `src/config/firm.ts`: business legal name, phone, hello@ email, mailing address, hours, response time (or leave response time unstated).
2. Decide Vercel Pro ($20/month) or a free host for the live project, then attach the domain (your go-ahead is still needed).
3. Create the lead store (Neon free through Vercel Storage) so form leads are saved, and run the two test leads.
4. Create the Cal.com account and event, set `NEXT_PUBLIC_CALCOM_LINK`, paste the webhook secret.
5. Get Sargun's written OK on: the site's referral structure under Illinois Rule 7.2, the pricing page, the first week of posts and emails, and whether to offer a free first call (if yes, posts can say so).
6. Create brand accounts: Google Business Profile, Instagram professional, Facebook page, LinkedIn company page, YouTube channel, Nextdoor business page. Same name and link everywhere.
7. Set `NEXT_PUBLIC_GTM_ID` and connect GA4; verify Search Console and Bing with a DNS TXT record in Cloudflare.
8. Re-render the social cards with the new brand and domain (or ask the social video thread to), and approve the first 7 shorts from PR #76.
9. Send the emails and posts yourself. Nothing here is sent automatically.
10. Approve or skip the ad budget (section 5). If approved: create Google Ads and Meta Business accounts, add a card, set the caps.
11. Fill `partner-targets.csv` with real names from the listed directories, and look up one real detail per contact before writing.
