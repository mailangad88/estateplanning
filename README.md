# Estate planning lead engine

Phase 1 foundation for the estate planning lead generation site described in the
[full system plan](https://claude.ai/code/artifact/63f19a58-6a5f-4b69-8828-0dc444a9a6da).

## What is here

- **Website** (Next.js): home page, plan finder quiz, draft legal pages.
- **Plan finder** (`/plan-finder`): 11 questions, then contact details with separate SMS consent and a
  "no attorney-client relationship" acknowledgment. Results are educational topics, never advice.
- **Lead API** (`POST /api/leads`): validates, records consent (exact text, version, page, IP, time),
  scores and tags the lead, and forwards it to the CRM through a signed webhook.
- **Fee rule engine** (`src/lib/fees.ts`): editable fee rules with a compliance lock. Percent-of-fee and
  per-signed-retainer rules are refused unless the business structure permits them and counsel approval
  is recorded. Under the launch structure (`in_firm`) nothing is invoiced.

## Lead capture tools

Every tool shows its headline result before asking for anything, then offers more (a full report or a guide) in
exchange for name, email, phone and state. All of them post to `/api/leads` through one shared form
(`src/components/LeadForm.tsx`), so consent, scoring and CRM delivery work the same everywhere.

| Page | What it does | `capture.tool` |
| --- | --- | --- |
| `/intake` | Five-step consult request: tap questions first, contact details last | `intake` (always hot) |
| `/callback` | Short call-back request with a preferred time | `callback` (always hot) |
| `/tools/plan-readiness-assessment` | Ten-question readiness score, gap report after the form | `readiness_score` |
| `/tools/probate-cost-estimator` | Probate cost range (California statutory schedule, general range elsewhere) | `cost_calculator` |
| `/tools/will-or-trust` | Which factors point toward a will or a trust, breakdown after the form | `will_vs_trust` |
| `/resources`, `/resources/[slug]` | Six printable guides, opened at `/resources/[slug]/read` (noindex) after the form | `guide` |
| Exit offer | Desktop-only exit-intent modal, once per visit, email-only starter kit | n/a (`/api/subscribe`) |
| Phone bar | Sticky Call, Text and Request a call back on phones | n/a |

- **CRM payload** now carries `capture` (tool, resource, figures), `visitorId` and `priorTools`, and segments gain
  `tool:*` and `resource:*` tags. The CRM automation should send the promised email (guide link or report copy)
  and, only when `consent.smsConsent` is true, a text.
- **Progressive profiling:** after a submission the visitor's contact details are kept in their browser, so later
  forms are prefilled with a "Not you? Clear them" link. Nothing is stored before a submission.
- **Scoring:** tool intent, repeat use, low readiness and calculator estate value add points (`SCORE_WEIGHTS`).
- **Calculator figures** live in `src/config/tools.ts` (cost ranges, 2026 federal and state estate tax thresholds,
  the firm's flat fees, and `phoneOptionalFor` to make phone optional on guides if conversion data says so).
  The attorney must verify them before launch. Research notes are in the project's shared
  `research/lead-capture-best-practices.md`.
## Lawyer portal and backend (`src/server`)

- **Access policy** (`auth/policy.ts`): one place for who sees what. An attorney with an open offer sees only the
  conflict card and a summary that names no one; accepting unlocks the full case. Intake sees intake fields but not
  engagement fees or documents. Marketing sees totals only. Paralegals see their attorneys' cases and can never
  approve an engagement. Clients see their own matter without internal comments. `db/schema.sql` repeats the same
  rules as Postgres row-level security.
- **Case view** (`portal/caseView.ts`, `/portal`, `/portal/leads/[id]`): every case in the same order (header,
  summary, red flags, conflict check, household, assets, documents, answers, timeline, comments, consult,
  engagement, tasks, source, audit). Opening a case is audited.
- **Routing** (`routing/engine.ts`, `services/routing.ts`): hard filters (licensure, matter type, conflict,
  capacity, language), soft ranking (distance, specialty, accept speed, show rate, reviews, never signed rate),
  round robin among ties, special cases (urgent goes to on-call, returning clients, named referrals, households,
  client choice). One offer at a time with an acceptance timer; timeouts re-route.
- **E-signed engagements** (`esign/`, `services/engagement.ts`): the attorney drafts from a package, approves
  (required, never automatic), then it is sent with an SMS code check and a payment link to the firm's own account.
  DocuSign and Dropbox Sign adapters plus a mock; webhooks are signature-checked and idempotent; reminders at
  24h, 72h and 7 days.
- **CRM sync** (`crm/`): Lawmatics by default, HubSpot ready, mock without credentials. Idempotent, retried with
  backoff, internal comments and consent IPs never leave the platform.
- **Nurture** (`nurture/`): every sequence from the plan, each step citing brain-file entries and needing approval.
  Guards for banned phrases, sensitive facts in texts and subject lines, quiet hours by state, Florida and Oklahoma
  text caps, and STOP handling in any wording.
- **Commission engine admin** (`fees/admin.ts`, `/admin/fees`): editable rates with a version history and a reason
  for every change, counsel approval as its own step (refused for prohibited fee types), invoices that snapshot
  rule versions, credits, and admin approval before anything is sent.
- **Audit log** (`audit/log.ts`): append-only and hash-chained so edits or deletions are detectable.
- **Automations** (`automation.ts`, `POST /api/cron/sweep`): reads the audit log as an event feed to enroll nurture,
  move sequences on stage changes and sync the CRM; the same sweep expires offers and sends reminders.

Try it: `ENABLE_DEV_LOGIN=true npm run dev`, open `/portal`, and sign in as any demo user. Development uses an
in-memory store with demo data. Production needs the Postgres store (`db/schema.sql`), real e-sign, payment and
CRM credentials, and an identity provider with two-step sign-in; each of those refuses to run as a mock in
production.

## Defaults to confirm

| Setting | Default | Where |
| --- | --- | --- |
| Business structure | `in_firm` (Model A: platform is the firm's marketing and intake department) | `src/config/firm.ts` |
| Launch state | `XX` placeholder | `SERVED_STATES` env var |
| CRM | Lawmatics, reached through a Zapier, Make or n8n webhook | `CRM_WEBHOOK_URL` env var |
| Firm name, attorney, bar number, phone, text number, hours, address | Placeholders | `src/config/firm.ts` |
| Text number | Must be registered for business texting (10DLC) before the Text button goes live | `firm.textNumber` |

All legal page copy, consent wording and quiz text are drafts that the attorney must approve before launch.

## Run it

```bash
npm install
cp .env.example .env.local   # set SERVED_STATES, CRM_WEBHOOK_URL
npm run dev
npm test
npm run typecheck
```

## Free resource library (lead magnets)

`content/magnets/` holds 60 gated resources (including 4 in Spanish): checklists, worksheets, planners, templates, kits and five 5-day
email courses (format in `content/magnets/README.md`). Each gets a landing page at `/free/<slug>` with an
email-only opt-in (`/api/subscribe`, `kind: "magnet"` or `"course"`, `interest: "magnet:<slug>"`, and
`details.tag` / `details.sequence` for CRM routing) and a printable, noindexed copy at `/free/<slug>/view`.
`/free` lists them all with topic, type and search filters.

Every guide, comparison, life-event page and blog post (through its pillar guide) shows the best matching
resource's opt-in plus up to two more, chosen from each resource's `related:` list (`src/lib/magnets.ts`).
Resources with `sequence: G` are for people after a death and must only receive the grief sequence.
The CRM automation must send the promised email with the `/free/<slug>/view` link (or the course lessons).

## Quizzes

`content/quizzes/*.json` (format in `content/quizzes/README.md`) power `/quizzes/<slug>`: one question per screen,
a free score and band, and an email-gated answer review that also sends a matching free resource
(`/api/subscribe`, `kind: "report"`, `interest: "quiz:<slug>"`).

## Consult booking (Cal.com)

The owner needs their own Cal.com account (none is created for you). Set `NEXT_PUBLIC_CALCOM_LINK` to
`username/event-slug` and the consult scheduler shows the Cal.com inline embed and tracks a `consult_booked`
event. Without it, `schedulerUrl` in `src/config/firm.ts` still works as a plain iframe. To move leads to the
`consult_booked` stage, create a webhook in Cal.com (booking created, rescheduled, cancelled) that points at
`/api/webhooks/calcom`, and put its secret in `CALCOM_WEBHOOK_SECRET`. Leads match by `metadata[leadRef]`, else attendee email.

## A/B tests and analytics

`src/lib/experiments.ts` assigns each visitor a stable variant per experiment (anonymous id, no personal data),
pushes `experiment_view` to the dataLayer and adds `exp_<name>` to opt-in details and `lead_capture` events.
Running now: `magnet_cta` (button copy), `magnet_fields` (name + email vs email only) and `quiz_gate`
(score first vs email first with a skip link). Preview a variant with `?exp_<name>=<variant>`.

Set `NEXT_PUBLIC_GTM_ID` to load Google Tag Manager (configure GA4 and ad tags there). `src/components/Analytics.tsx`
also sends `scroll_depth` and `cta_click`; tools and quizzes send `tool_view`, `tool_start` and `tool_complete`.
No event carries names, emails, phone numbers or answers.
