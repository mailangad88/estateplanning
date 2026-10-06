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
