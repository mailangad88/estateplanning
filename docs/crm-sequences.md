# CRM-owned sequences

Status: written 2026-10. Nothing here sends a real message until the firm turns it on.

## What this is

Campaigns (the follow-up email and text sequences) can run in the firm's CRM instead of in this app.
Set `NURTURE_OWNER=crm` and the CRM sends. The app stays the system of record for leads, consent and
suppressions, and tells the CRM everything it needs to know so the CRM's automations stay correct.

**Decision 2026-10-06: internal is the chosen default.** Angad chose the lowest-cost route: our own portal and sender run follow-up (email through Resend, texts through Twilio), the HubSpot free CRM adapter is an optional sync, and the Lawmatics adapter stays dormant. `crm` below remains an opt-in for later. Bounces and complaints come in at `POST /api/email/events` (Resend, Svix-signed) and STOP/START texts at `POST /api/sms/inbound` (Twilio-signed). Costs: research/crm-buy-vs-build.md.

`NURTURE_OWNER` is `internal` by default. `crm` only takes effect when a live CRM token is set
(`LAWMATICS_API_TOKEN`, or `CRM_PROVIDER=hubspot` with `HUBSPOT_PRIVATE_APP_TOKEN`). With the mock or no token it stays
`internal`, so a missing CRM never silently stops follow-up. An unknown value is reported as an error by the cron sweep.

## What the CRM must be set up with

The app writes these on every enrollment, stage change, exit and opt-out. Create them in the CRM first.
Field and tag names are ours. **The API calls that write them (endpoint paths, whether tags replace or append, how
opt-out is set) are marked "to be verified" in the adapter code and must be checked against Lawmatics / HubSpot docs
before launch.**

Custom fields (text, values "true" / "false" unless noted):

| Field | Meaning |
| --- | --- |
| `ep_sequences` | Active sequence ids, `;` separated (e.g. `quiz_follow_up;life_event_...`) |
| `ep_sequence_group` | Letter A to G (or `long_term`) of the first active sequence |
| `ep_email_consent` / `ep_sms_consent` | Consent we hold per channel |
| `ep_email_suppressed` / `ep_sms_suppressed` | Unsubscribed, STOP, bounced or complained |
| `ep_grief_track` | After-a-death lead. Never market |
| `ep_consult_booked` / `ep_consult_held` | Stage reached |
| `ep_retainer_signed` | Client. Marketing sequences must stop |
| `ep_do_not_market` | One flag to gate every marketing automation (grief, retainer signed, lost lead, partner referral, or both channels suppressed) |

Tags (same data for CRMs that trigger on tags): `ep-seq-<sequence id>`, `ep-email-ok`, `ep-sms-ok`,
`ep-email-suppressed`, `ep-sms-suppressed`, `ep-grief-track`, `ep-consult-booked`, `ep-consult-held`,
`ep-retainer-signed`, `ep-do-not-market`.

### The sequences (A to G) to build in the CRM

Copy comes from the attorney-approved templates at `/portal/templates`; paste only approved text. Timing and steps are in
`src/server/nurture/sequences.ts`.

| Group | Our sequence ids | Starts when |
| --- | --- | --- |
| A | `speed_to_lead`, `quiz_follow_up`, life-event tracks | New lead; quiz completed; segment tag |
| B | `magnet_follow_up` | Guide or checklist download |
| C | `consult_booked`, `no_show_recovery` | Stage consult booked; no-show |
| D | `consult_held_not_signed` | Stage consult held, then monthly |
| E | `signed_onboarding` | Stage retainer signed (service messages, not marketing) |
| F | `plan_complete`, `review_request`, `annual_review` | Stage plan complete |
| G | `grief_support` | After-a-death lead. Few messages, human first |
| (none) | `long_term` | Monthly newsletter for quiet or unresponsive leads |

The letter grouping for A, C and F is inferred from the template copy headings; confirm it with the attorney.

### Rules the CRM automations must follow

- **Grief rule.** Anything with `ep_grief_track` = true gets only group G, and no marketing of any kind. The app never
  sends the grief flag as a segment name; it is a plain flag.
- **Consent.** Email only with `ep_email_consent` and not suppressed. SMS only with `ep_sms_consent` (its own checkbox) and not suppressed.
- **Stop conditions.** Leave a sequence when `ep_do_not_market` is true, the lead is lost, or `ep_retainer_signed` is true
  (except group E and F service messages).
- **Quiet hours.** No texts outside 8am to 9pm in the lead's own time zone (8am to 8pm in FL and OK). The lead's state is on the contact.
- **Frequency caps.** At most 2 marketing emails a day; at most 3 marketing texts in 24 hours for FL and OK leads.
- **STOP.** A STOP or unsubscribe ends that channel for good; "do not contact" ends both. The CRM must honor its own
  opt-outs and send them to us (below).
- **Sensitive content.** No health, money, death or family-conflict words in text bodies or email subject lines.
- **Footer.** Firm name, postal address, unsubscribe link, and the "educational information, not legal advice" line.

## What we still do in-house

- Lead capture, scoring, triage, routing, conflict check, and the CRM sync (contact, matter, stage, notes).
- Consent records and the suppression list (the source of truth).
- **Call tasks.** Sequence steps that are calls still create intake call tasks. The sender reports
  `crmOwned` for the email and text steps it left to the CRM.
- Unsubscribe page and one-click link: `POST /api/unsubscribe` records the suppression and pushes it to the CRM.
- Inbound events: `POST /api/crm/events` accepts `unsubscribe`, `bounce` and `complaint` from the CRM and records the suppression locally.
- Attorney approval of template copy, and the audit log.
- Cron sweep: with `NURTURE_OWNER=crm` it skips message sends and returns `nurtureOwner: "crm"` plus `crmOwned` counts in the `nurture` job result.

### Inbound webhook

`POST /api/crm/events`, JSON body `{ "type": "unsubscribe" | "bounce" | "complaint", "channel": "email" | "sms", "email": "...", "phone": "..." }`.
Headers: `x-timestamp` (unix seconds) and `x-signature` (hex HMAC-SHA256 of `<timestamp>.<raw body>` using `CRM_WEBHOOK_SECRET`).
Requests more than 5 minutes off the clock are rejected; no secret configured means every request is refused.
Lawmatics and HubSpot sign their own webhooks differently, so point their webhook at a small relay (n8n, Zapier, or a
workflow "send webhook" step that can sign) that produces this format. To be verified for each CRM.

## How to switch

1. Create the fields and tags above, build sequences A to G with approved copy, and test with a staff contact.
2. Set the CRM token, `CRM_WEBHOOK_SECRET`, and wire the CRM's unsubscribe/bounce events to `/api/crm/events`.
3. Set `NURTURE_OWNER=crm`. The next sweep pushes state for each lead as it changes (existing leads update on their next stage change or opt-out).
4. Watch the sweep response: `nurtureOwner` should read `crm`. Keep `OUTBOUND_SEND_MODE=log` for the transactional stream you still run yourself.
5. Switching back: set `NURTURE_OWNER=internal`. Steps the CRM already sent were never recorded here, so before going back, stop old enrollments (or accept that due steps will go out in dry run first) to avoid a backlog of stale messages.

## Cost and setup

Prices checked 2026-10 from the vendor pages named. Where a price is not published it says so. All are approximate and change; get a quote.

| Option | Monthly cost (approx.) | Source | Notes |
| --- | --- | --- | --- |
| Lawmatics | **Not published.** Quote only; plans Essential (3 user minimum, 500 contacts), Premium (3 users, 10,000 contacts, workflow and marketing automation, 50,000 email sends/month), Enterprise (5 users) | https://www.lawmatics.com/pricing and https://www.capterra.com/p/177717/Lawmatics/pricing/ | Built for law firms. Automation needs Premium or above. Texting and API access: confirm in the quote. |
| HubSpot Marketing Hub Starter | Page shows $7 per seat on monthly billing and $20 per seat on annual billing (promotional "special Starter pricing"; the two figures look inconsistent, so confirm at checkout); 1,000 marketing contacts; Starter automation is limited to about 10 automated actions | https://www.hubspot.com/pricing/marketing and https://www.hubspot.com/pricing/marketing/starter | SMS is an add-on that requires Marketing Hub Professional or Enterprise (via Twilio, price not published). Professional is $800 per month (annual $890 shown, which also looks inconsistent) plus a $3,000 one-time onboarding fee. https://knowledge.hubspot.com/sms/set-up-sms-messaging |
| HubSpot Starter + separate texting | About $20 to $50 per month for Starter, plus Twilio texting below. HubSpot cannot send the texts itself at Starter | as above, and https://www.twilio.com/en-us/sms/pricing/us | Texting would be sent by our app or another tool, using the same suppression list. More moving parts. |
| Clio Grow | **Not published** on Clio's pricing page; sold through sales as an add-on to Clio Core or Signature, included with Elite. Capterra lists Clio (the practice-management product) at $49 per user per month, which is not Grow's price | https://www.clio.com/pricing/ and https://www.capterra.com/p/105428/Clio/pricing | Intake forms, booking, automated client emails. Texting and API access not stated. |
| Apollo.io | Free; Basic $49 per user; Professional $99 per user; Custom from $5,000 a year (third-party listing; Apollo's own page did not show figures to us) | https://www.apollo.io/pricing and https://www.capterra.com/p/158696/Apollo/pricing/ | See fit note below. |
| Our own build (Postmark + Twilio) | About $15 to $18 for Postmark (10,000 emails), texting about $0.0083 per message plus carrier fees (about $0.004 more) and $1.15 for a number; typical firm volume: under $50 per month in provider costs, plus your time | https://postmarkapp.com/pricing and https://www.twilio.com/en-us/sms/pricing/us | See below. Twilio's 10DLC registration fees are not shown on that page. |

### Apollo.io: fit

Apollo is a B2B prospecting and cold-outbound tool: a contact database plus email sequences for sales reps. It does not
handle consumer intake, consent capture, texting compliance or after-signing service messages. It could only be useful for
**referral-partner outreach** (CPAs, financial advisors, realtors). That outreach is cold email, so CAN-SPAM
(truthful headers, postal address, working opt-out) applies, and lawyer advertising and solicitation rules apply: state bar
rules on lawyer advertising and referrals, no payment for referrals, and no targeting of anyone in a way the bar's rules
forbid. The attorney must approve every partner email. It is not a replacement for Lawmatics or our sender. Do not load consumer leads into it.

### Our own build: what exists and what is missing

Already built: sequence definitions A to G, scheduler (consent, suppression, quiet hours, frequency caps, grief rule), attorney
template approval, Postmark and Twilio transports in dry-run mode, unsubscribe link and one-click header, opt-out handling.

Missing to run it for real: sending-domain setup and deliverability monitoring (SPF/DKIM/DMARC, warm-up, inbox placement),
bounce and complaint intake from Postmark and Twilio, 10DLC registration and its carrier review, a campaign editor so non-developers can
change sequences, reporting (opens, replies, bookings per sequence), and ongoing maintenance (provider changes, template edits,
failures). Provider cost is modest (see table); the real cost is staff and developer time, and the risk of a mistake going to real clients.

## What Angad would need to supply

- A CRM account (Lawmatics, or HubSpot) with API access, and the API token (private-app token for HubSpot).
- Sending domain DNS for the CRM's email: SPF, DKIM and DMARC records at the domain registrar.
- 10DLC registration for texting (brand and campaign, through the CRM's texting provider or Twilio), which carriers review for days to weeks.
- A shared webhook secret (`CRM_WEBHOOK_SECRET`) and a relay for the CRM's unsubscribe and bounce events.
- The attorney's approval of the copy used in each sequence, and the firm's postal address for email footers.

## Recommendation

Buy the CRM for campaigns. Use Lawmatics if the quote fits the firm's budget, because it is built for law firms and its
Premium tier includes the marketing automation and email volume this needs; get a written quote that states texting, API access and the user minimum
before signing. If Lawmatics is too expensive, HubSpot Starter plus our own texting is the cheaper route but is clumsier. Keep
our own sender as the dry-run fallback and as the owner of consent, suppressions and call tasks. Treat Apollo as an optional
extra for referral-partner outreach only, never for clients. Building the full campaign tool in-house costs less in subscriptions
but more in time and risk, and is not worth doing at this stage.
