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
| Firm name, attorney, bar number, phone, address | Placeholders | `src/config/firm.ts` |

All legal page copy, consent wording and quiz text are drafts that the attorney must approve before launch.

## Run it

```bash
npm install
cp .env.example .env.local   # set SERVED_STATES, CRM_WEBHOOK_URL
npm run dev
npm test
npm run typecheck
```
