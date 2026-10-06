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
| `/tools/readiness` | Ten-question readiness score, gap report after the form | `readiness_score` |
| `/tools/probate-cost` | Probate cost range (California statutory schedule, general range elsewhere) | `cost_calculator` |
| `/tools/will-or-trust` | Which factors point toward a will or a trust, breakdown after the form | `will_vs_trust` |
| `/resources`, `/resources/[slug]` | Six printable guides, opened at `/guides/[slug]` (noindex) after the form | `guide` |
| Exit offer | Desktop exit-intent modal or small mobile banner, once per 14 days, never to known visitors | `exit_offer` |
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

`content/magnets/` holds 44 gated resources: checklists, worksheets, planners, templates, kits and five 5-day
email courses (format in `content/magnets/README.md`). Each gets a landing page at `/free/<slug>` with an
email-only opt-in (`/api/subscribe`, `kind: "magnet"` or `"course"`, `interest: "magnet:<slug>"`, and
`details.tag` / `details.sequence` for CRM routing) and a printable, noindexed copy at `/free/<slug>/view`.
`/free` lists them all with topic, type and search filters.

Every guide, comparison, life-event page and blog post (through its pillar guide) shows the best matching
resource's opt-in plus up to two more, chosen from each resource's `related:` list (`src/lib/magnets.ts`).
Resources with `sequence: G` are for people after a death and must only receive the grief sequence.
The CRM automation must send the promised email with the `/free/<slug>/view` link (or the course lessons).
