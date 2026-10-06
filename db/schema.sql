-- Estate planning lead platform: Postgres 15+ schema with row-level security.
--
-- RLS is the SECOND layer. The first is src/server/auth/policy.ts; every rule
-- below mirrors leadAccess / canOnLead / readableVisibilities / writableVisibilities
-- there. If you change one, change the other (and tests/schema.test.ts).
--
-- Apply as the schema owner (a superuser, or a role allowed to CREATE ROLE ... BYPASSRLS).
-- The web app connects as a login role that is a member of `app_user`; background
-- workers (public intake form, webhooks, nurture engine) use `app_service`.
-- Per request, inside a transaction, the app sets:
--   set_config('app.user_id' | 'app.role' | 'app.firm_id' | 'app.lawyer_id'
--              | 'app.person_id' | 'app.supports_lawyer_ids' (comma list), <value>, true)

BEGIN;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;      -- placeholder: GRANT app_user TO your login role
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    CREATE ROLE app_service NOLOGIN;   -- trusted workers; has its own permissive policies
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_helper') THEN
    -- Owns the SECURITY DEFINER helpers and views so they can read base tables
    -- without recursing into the policies that call them. Never granted to anyone.
    CREATE ROLE rls_helper NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE firms (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  structure text NOT NULL CHECK (structure IN ('in_firm','marketing_services','certified_lrs','abs','saas'))
);

CREATE TABLE lawyers (
  id                  text PRIMARY KEY,
  firm_id             text NOT NULL REFERENCES firms(id),
  name                text NOT NULL,
  email               text NOT NULL,
  phone               text,
  bio                 text,
  licensed_states     text[] NOT NULL DEFAULT '{}',
  matter_types        text[] NOT NULL DEFAULT '{}'
    CHECK (matter_types <@ ARRAY['new_plan','update_plan','administration','elder_law','special_needs','business_succession']),
  specialties         text[] NOT NULL DEFAULT '{}'
    CHECK (specialties <@ ARRAY['special_needs','business_succession','blended_family','tax','medicaid','probate']),
  languages           text[] NOT NULL DEFAULT '{}',
  weekly_capacity     integer NOT NULL CHECK (weekly_capacity >= 0),
  active_lead_cap     integer NOT NULL CHECK (active_lead_cap >= 0),
  accept_sla_minutes  integer NOT NULL CHECK (accept_sla_minutes > 0),
  office              jsonb,                       -- {lat, lng}
  on_call             boolean NOT NULL DEFAULT false,
  active              boolean NOT NULL DEFAULT true,
  stats               jsonb NOT NULL DEFAULT '{"avgAcceptMinutes":0,"showRate":0,"reviewScore":0}'
);
CREATE INDEX lawyers_firm_idx ON lawyers (firm_id);

CREATE TABLE persons (
  id           text PRIMARY KEY,
  first_name   text NOT NULL,
  last_name    text NOT NULL,
  email        text NOT NULL,
  phone        text NOT NULL,
  language     text NOT NULL DEFAULT 'en',
  state        text NOT NULL,
  county       text,
  household_id text
);
CREATE INDEX persons_email_idx ON persons (lower(email));

CREATE TABLE users (
  id                   text PRIMARY KEY,
  email                text NOT NULL UNIQUE,
  name                 text NOT NULL,
  role                 text NOT NULL CHECK (role IN ('platform_admin','intake','marketing','firm_admin','attorney','paralegal','client')),
  firm_id              text REFERENCES firms(id),
  lawyer_id            text REFERENCES lawyers(id),
  supports_lawyer_ids  text[],
  person_id            text REFERENCES persons(id),
  active               boolean NOT NULL DEFAULT true,
  CHECK (role NOT IN ('firm_admin','attorney','paralegal') OR firm_id IS NOT NULL),
  CHECK (role <> 'attorney' OR lawyer_id IS NOT NULL),
  CHECK (role <> 'client' OR person_id IS NOT NULL)
);
CREATE INDEX users_firm_idx ON users (firm_id);

CREATE TABLE leads (
  id                        text PRIMARY KEY,
  person_id                 text NOT NULL REFERENCES persons(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  stage                     text NOT NULL CHECK (stage IN ('new','contacted','qualified','conflict_check','offered','accepted',
    'consult_booked','consult_held','proposal_sent','retainer_signed','paid','drafting','signing_scheduled','plan_complete','annual_review')),
  stage_history             jsonb NOT NULL DEFAULT '[]',     -- [{stage, at, by}]
  exit                      jsonb,                           -- {reason, at, note?}
  matter_type               text NOT NULL CHECK (matter_type IN ('new_plan','update_plan','administration','elder_law','special_needs','business_succession')),
  state                     text NOT NULL,
  county                    text,
  urgent                    boolean NOT NULL DEFAULT false,
  score                     jsonb NOT NULL,
  segments                  text[] NOT NULL DEFAULT '{}',
  source                    jsonb NOT NULL DEFAULT '{}',     -- utm_* etc
  consent                   jsonb NOT NULL,
  offer_summary             text NOT NULL,                   -- non-confidential, shown with an offer
  conflict_card             jsonb NOT NULL,
  intake                    jsonb NOT NULL,                  -- confidential; never exposed to offer-stage viewers
  firm_id                   text REFERENCES firms(id),
  assigned_lawyer_id        text REFERENCES lawyers(id),
  previous_lawyer_id        text REFERENCES lawyers(id),
  requested_lawyer_id       text REFERENCES lawyers(id),
  client_choice_lawyer_ids  text[],
  crm_id                    text,
  intake_owner_id           text REFERENCES users(id),
  capture                   jsonb,                           -- {tool, resource?, result?}: which site tool captured the lead
  prior_tools               text[],                          -- capture tools this visitor used before, oldest first
  visitor_id                text,                            -- browser id used to merge repeat submissions
  CHECK (assigned_lawyer_id IS NULL OR firm_id IS NOT NULL)
);
CREATE INDEX leads_assigned_lawyer_idx ON leads (assigned_lawyer_id) WHERE assigned_lawyer_id IS NOT NULL;
CREATE INDEX leads_firm_idx         ON leads (firm_id) WHERE firm_id IS NOT NULL;
CREATE INDEX leads_person_idx       ON leads (person_id);
CREATE INDEX leads_stage_idx        ON leads (stage, created_at);
CREATE INDEX leads_intake_owner_idx ON leads (intake_owner_id);
CREATE INDEX leads_created_idx      ON leads (created_at);

CREATE TABLE assignments (
  id              text PRIMARY KEY,
  lead_id         text NOT NULL REFERENCES leads(id),
  lawyer_id       text NOT NULL REFERENCES lawyers(id),
  firm_id         text NOT NULL REFERENCES firms(id),
  offered_at      timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,
  status          text NOT NULL CHECK (status IN ('offered','accepted','declined','expired','withdrawn')),
  responded_at    timestamptz,
  decline_reason  text CHECK (decline_reason IN ('conflict','capacity','out_of_scope','other')),
  note            text,
  sla_met         boolean,
  routing_reason  text NOT NULL
);
CREATE INDEX assignments_lawyer_status_idx ON assignments (lawyer_id, status);
CREATE INDEX assignments_firm_status_idx   ON assignments (firm_id, status);
CREATE INDEX assignments_lead_status_idx   ON assignments (lead_id, status);
CREATE INDEX assignments_open_offers_idx   ON assignments (expires_at) WHERE status = 'offered';

CREATE TABLE documents (
  id            text PRIMARY KEY,
  lead_id       text NOT NULL REFERENCES leads(id),
  name          text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('existing_will','deed','trust','beneficiary_form','engagement_signed','audit_certificate','payment_receipt','other')),
  content_type  text NOT NULL,
  size_bytes    bigint NOT NULL CHECK (size_bytes >= 0),
  storage_key   text NOT NULL,
  uploaded_by   text NOT NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  scan_status   text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','infected')),
  visibility    text NOT NULL CHECK (visibility IN ('internal','firm','client'))
);
CREATE INDEX documents_lead_idx ON documents (lead_id);

CREATE TABLE comments (
  id          text PRIMARY KEY,
  lead_id     text NOT NULL REFERENCES leads(id),
  parent_id   text REFERENCES comments(id),
  author_id   text NOT NULL,
  author_name text NOT NULL,
  body        text NOT NULL,
  visibility  text NOT NULL CHECK (visibility IN ('internal','firm','client')),
  mentions    text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_lead_idx ON comments (lead_id, created_at);

CREATE TABLE activities (
  id            text PRIMARY KEY,
  lead_id       text NOT NULL REFERENCES leads(id),
  kind          text NOT NULL CHECK (kind IN ('call','sms','email','meeting','system')),
  direction     text CHECK (direction IN ('inbound','outbound')),
  at            timestamptz NOT NULL,
  summary       text NOT NULL,
  recording_url text,
  transcript    text,
  by_user_id    text
);
CREATE INDEX activities_lead_idx ON activities (lead_id, at);

CREATE TABLE consults (
  id        text PRIMARY KEY,
  lead_id   text NOT NULL REFERENCES leads(id),
  lawyer_id text NOT NULL REFERENCES lawyers(id),
  at        timestamptz NOT NULL,
  type      text NOT NULL CHECK (type IN ('video','phone','office')),
  status    text NOT NULL CHECK (status IN ('booked','held','no_show','cancelled')),
  outcome   text CHECK (outcome IN ('proposal','not_now','not_a_fit')),
  notes     text
);
CREATE INDEX consults_lead_idx   ON consults (lead_id);
CREATE INDEX consults_lawyer_idx ON consults (lawyer_id, at);

CREATE TABLE engagements (
  id                   text PRIMARY KEY,
  lead_id              text NOT NULL REFERENCES leads(id),
  firm_id              text NOT NULL REFERENCES firms(id),
  lawyer_id            text NOT NULL REFERENCES lawyers(id),
  package_id           text NOT NULL,
  fee_cents            bigint NOT NULL CHECK (fee_cents >= 0),
  custom_scope         text,
  status               text NOT NULL CHECK (status IN ('draft','approved','sent','viewed','signed','paid','countersigned','voided')),
  provider             text NOT NULL,
  provider_envelope_id text,
  letter               text,
  approved_by          text,
  approved_at          timestamptz,
  history              jsonb NOT NULL DEFAULT '[]',        -- [{status, at}]
  reminders_sent       text[] NOT NULL DEFAULT '{}',
  document_ids         text[] NOT NULL DEFAULT '{}',
  package_selection    jsonb,                              -- {tierId, tierName, tierPriceCents, addOns[], totalCents}: attorney-set prices
  payment_plan         jsonb                               -- {mode, totalCents, account, installments[{n, kind, amountCents, dueOn, status, paymentId, paidAt}]}
);
CREATE INDEX engagements_lead_idx   ON engagements (lead_id);
CREATE INDEX engagements_lawyer_idx ON engagements (lawyer_id, status);

-- One row per payment attempt for an engagement. Money moves from the client straight to the
-- firm's own processor account; this table records what was asked for and what the processor
-- confirmed, plus which firm account (operating or trust) the payment was directed to.
CREATE TABLE payments (
  id                  text PRIMARY KEY,
  engagement_id       text NOT NULL REFERENCES engagements(id),
  lead_id             text NOT NULL REFERENCES leads(id),
  firm_id             text NOT NULL REFERENCES firms(id),
  installment_no      bigint,
  amount_cents        bigint NOT NULL CHECK (amount_cents > 0),
  account             text NOT NULL CHECK (account IN ('operating','trust')),
  status              text NOT NULL CHECK (status IN ('pending','paid','failed')),
  provider            text NOT NULL,
  provider_payment_id text NOT NULL,
  link_url            text,
  created_at          timestamptz NOT NULL,
  paid_at             timestamptz,
  refunds             jsonb NOT NULL DEFAULT '[]',        -- [{id, amountCents, at, reason}]
  UNIQUE (provider, provider_payment_id)
);
CREATE INDEX payments_engagement_idx ON payments (engagement_id);
CREATE INDEX payments_lead_idx       ON payments (lead_id);

CREATE TABLE tasks (
  id       text PRIMARY KEY,
  lead_id  text NOT NULL REFERENCES leads(id),
  title    text NOT NULL,
  owner_id text NOT NULL,
  due_at   timestamptz NOT NULL,
  done_at  timestamptz
);
CREATE INDEX tasks_lead_idx ON tasks (lead_id);
CREATE INDEX tasks_open_owner_idx ON tasks (owner_id, due_at) WHERE done_at IS NULL;

CREATE TABLE fee_rule_versions (
  id          text PRIMARY KEY,                -- '<ruleId>@<version>'
  rule_id     text NOT NULL,
  version     integer NOT NULL CHECK (version > 0),
  rule        jsonb NOT NULL,
  edited_by   text NOT NULL,
  edited_at   timestamptz NOT NULL,
  reason      text NOT NULL,
  billable    boolean NOT NULL,
  lock_reason text,
  counsel     jsonb,                           -- {name, opinionRef}
  UNIQUE (rule_id, version)
);

CREATE TABLE billable_events (
  id           text PRIMARY KEY,
  type         text NOT NULL CHECK (type IN ('month_started','lead_delivered','consult_booked','ad_spend_posted','seat_active','fee_collected','retainer_signed')),
  occurred_at  timestamptz NOT NULL,
  state        text,
  lawyer_id    text REFERENCES lawyers(id),
  amount_cents bigint
);
CREATE INDEX billable_events_type_idx ON billable_events (type, occurred_at);

CREATE TABLE invoices (
  id            text PRIMARY KEY,
  firm_id       text NOT NULL REFERENCES firms(id),
  period_start  date NOT NULL,                 -- inclusive
  period_end    date NOT NULL,                 -- exclusive
  structure     text NOT NULL CHECK (structure IN ('in_firm','marketing_services','certified_lrs','abs','saas')),
  lines         jsonb NOT NULL DEFAULT '[]',
  total_cents   bigint NOT NULL,
  blocked_rules jsonb NOT NULL DEFAULT '[]',
  status        text NOT NULL CHECK (status IN ('draft','approved','sent','void')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text NOT NULL,
  approved_by   text,
  credits       jsonb NOT NULL DEFAULT '[]',
  CHECK (period_end > period_start)
);
CREATE INDEX invoices_firm_period_idx ON invoices (firm_id, period_start);

CREATE TABLE sequence_enrollments (
  id              text PRIMARY KEY,
  lead_id         text NOT NULL REFERENCES leads(id),
  sequence_id     text NOT NULL,
  enrolled_at     timestamptz NOT NULL,
  status          text NOT NULL CHECK (status IN ('active','completed','stopped')),
  stopped_reason  text,
  sent_step_ids   text[] NOT NULL DEFAULT '{}',
  skipped         jsonb
);
CREATE INDEX enrollments_lead_idx ON sequence_enrollments (lead_id);
CREATE INDEX enrollments_active_idx ON sequence_enrollments (sequence_id) WHERE status = 'active';

CREATE TABLE suppressions (
  id      text PRIMARY KEY,                    -- '<channel>:<address>'
  channel text NOT NULL CHECK (channel IN ('email','sms','call_task','all')),
  address text NOT NULL,
  reason  text NOT NULL,
  at      timestamptz NOT NULL
);

-- Attorney approval of a published state fact or dollar figure (src/lib/facts.ts). Append-only:
-- a new approval is a new version, so the history of what was approved and by whom is kept.
CREATE TABLE fact_verifications (
  id             text PRIMARY KEY,             -- '<factId>@<version>'
  fact_id        text NOT NULL,                -- registry id, e.g. 'state.CA.small_estate_threshold'
  version        integer NOT NULL CHECK (version > 0),
  approved_value text NOT NULL,                -- the exact value text the attorney approved
  approved_by    text NOT NULL,
  approved_at    timestamptz NOT NULL,
  note           text NOT NULL,
  UNIQUE (fact_id, version)
);

-- Attorney approval of nurture message copy (src/server/nurture/templates.ts). Append-only: a new approval is a
-- new version. An approval counts only while content_hash equals the hash of the template's current copy.
CREATE TABLE template_approvals (
  id            text PRIMARY KEY,              -- '<templateKey>@<version>'
  template_key  text NOT NULL,                 -- step templateKey, e.g. 'qz_1_results'
  version       integer NOT NULL CHECK (version > 0),
  content_hash  text NOT NULL,                 -- sha256 of channel, subject and body as approved
  approved_by   text NOT NULL,
  approved_at   timestamptz NOT NULL,
  note          text NOT NULL,
  UNIQUE (template_key, version)
);

-- Attorney approval of a site page for publication (src/server/content/pageApprovals.ts). Append-only. An
-- approval counts only while content_hash equals the sha256 of the page's content file now; content files
-- live in the repo, so scripts/apply-page-approvals.mjs writes the frontmatter flag in a normal commit.
CREATE TABLE page_approvals (
  id            text PRIMARY KEY,
  path          text NOT NULL,                 -- site path, e.g. '/learn/wills/what-is-a-will'
  file          text NOT NULL,                 -- content file relative to the repo root
  content_hash  text NOT NULL,                 -- sha256 of the file's bytes as reviewed
  tier          text NOT NULL CHECK (tier IN ('low','medium','high')),
  approved_by   text NOT NULL,
  approver_role text NOT NULL,
  approver_name text NOT NULL,
  approved_at   timestamptz NOT NULL,
  note          text NOT NULL,
  batch_id      text NOT NULL,
  pr_url        text,                          -- the pull request carrying the flag into git, if one was opened
  edited_from_hash text,                       -- set when edited in the portal: hash of the file before the edits
  UNIQUE (path, content_hash)
);

-- Second factor per user (src/server/pg/mfa.ts). Secret encrypted by the app (AES-256-GCM).
CREATE TABLE user_mfa (
  user_id              text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  totp_secret_enc      text NOT NULL,
  last_used_step       bigint NOT NULL DEFAULT 0,
  recovery_code_hashes text[] NOT NULL DEFAULT '{}',
  enrolled_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Automation runner cursor (src/server/automation.ts). Only app_service touches it; no client data.
CREATE TABLE automation_state (
  id         text PRIMARY KEY CHECK (id = 'automation'),
  cursor_seq bigint NOT NULL DEFAULT 0,
  stages     jsonb NOT NULL DEFAULT '{}'::jsonb,
  exits      jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- One row per website-to-middleware webhook delivery (src/lib/crm.ts, src/server/leadDelivery.ts).
-- id is the idempotency key. Holds ids, status and a short error only: never the payload or any contact detail.
-- lead_id has no FK: a delivery can outlive, or precede, the portal copy of the lead.
CREATE TABLE crm_deliveries (
  id              text PRIMARY KEY,
  lead_id         text NOT NULL,
  event           text NOT NULL,
  status          text NOT NULL CHECK (status IN ('delivered','failed','abandoned')),
  http_status     integer,
  attempts        integer NOT NULL DEFAULT 0,
  error           text,
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL,
  last_attempt_at timestamptz NOT NULL,
  delivered_at    timestamptz
);
CREATE INDEX crm_deliveries_lead_idx ON crm_deliveries (lead_id);
CREATE INDEX crm_deliveries_status_idx ON crm_deliveries (status, last_attempt_at);

-- Seminars, webinars and community talks with their costs and entered counts (seminar economics, C17).
-- Leads attribute through utm_campaign = code or a "seminar:<code>" tag; no personal data lives here.
CREATE TABLE seminars (
  id          text PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  title       text NOT NULL,
  format      text NOT NULL CHECK (format IN ('in_person','webinar','library_talk')),
  held_on     date NOT NULL,
  venue       text,
  costs       jsonb NOT NULL DEFAULT '{}',
  mail_pieces integer CHECK (mail_pieces >= 0),
  rsvps       integer NOT NULL DEFAULT 0 CHECK (rsvps >= 0),
  attendees   integer NOT NULL DEFAULT 0 CHECK (attendees >= 0),
  notes       text,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL
);

-- Referral partners (src/server/services/partners.ts, src/lib/partners.ts). Tracking only: nothing here records a payment,
-- because the firm pays nothing for referrals (ABA Model Rule 7.2(b)). No client contact details live in these tables;
-- a referral points at its lead by id.
CREATE TABLE partners (
  id                           text PRIMARY KEY,
  slug                         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'),
  name                         text NOT NULL,
  org                          text NOT NULL,
  type                         text NOT NULL CHECK (type IN ('cpa','financial_advisor','funeral_home','elder_care','realtor','other')),
  ref_code                     text NOT NULL UNIQUE,
  status                       text NOT NULL CHECK (status IN ('prospect','active_sequence','active','paused','do_not_contact')),
  owner_id                     text REFERENCES users(id),
  firm_id                      text REFERENCES firms(id),
  created_at                   timestamptz NOT NULL,
  policy_signed_date           date,
  reciprocal_agreement_on_file boolean NOT NULL DEFAULT false,
  agreement_nonexclusive       boolean NOT NULL DEFAULT false,
  notes                        text
);

-- Gift log. Blocked gifts (tied to a referral, or a thing of value) are never stored; flagged ones wait for review.
CREATE TABLE partner_gifts (
  id           text PRIMARY KEY,
  partner_id   text NOT NULL REFERENCES partners(id),
  date         date NOT NULL,
  description  text NOT NULL,
  value_cents  integer NOT NULL CHECK (value_cents >= 0),
  status       text NOT NULL CHECK (status IN ('ok','flagged')),
  flags        text[] NOT NULL DEFAULT '{}',
  logged_by    text NOT NULL,
  review_note  text
);
CREATE INDEX partner_gifts_partner_idx ON partner_gifts (partner_id, date);

CREATE TABLE partner_referrals (
  id                 text PRIMARY KEY,
  partner_id         text NOT NULL REFERENCES partners(id),
  ref_code           text NOT NULL,
  lead_id            text UNIQUE REFERENCES leads(id),
  created_at         timestamptz NOT NULL,
  origin             text NOT NULL CHECK (origin IN ('partner_form','ref_link')),
  client_consent     boolean NOT NULL,
  disclosure_given   boolean NOT NULL DEFAULT false,
  disclosure_at      timestamptz,
  disclosure_version text,
  release_status     text NOT NULL DEFAULT 'none' CHECK (release_status IN ('none','requested','granted','revoked')),
  release_updated_at timestamptz,
  release_updated_by text,
  value_linked       text NOT NULL DEFAULT 'unanswered' CHECK (value_linked IN ('unanswered','no','yes')),
  value_note         text,
  -- A partner-submitted referral always carries the client's agreement to be referred (Rule 1.6).
  CHECK (origin <> 'partner_form' OR client_consent)
);
CREATE INDEX partner_referrals_partner_idx ON partner_referrals (partner_id);
-- Conversions log (src/server/conversions): one row per lead, conversion type and provider, so each event is sent once.
-- id is '<provider>:<type>:<lead_id>'. Ids, times, status and value only: contact details are rebuilt from the lead at send time.
CREATE TABLE conversion_events (
  id          text PRIMARY KEY,
  lead_id     text NOT NULL REFERENCES leads(id),
  provider    text NOT NULL CHECK (provider IN ('google_ads','meta')),
  type        text NOT NULL CHECK (type IN ('qualified_lead','consult_booked','consult_held','retainer_signed')),
  event_id    text NOT NULL,                     -- dedupe key sent to Meta
  occurred_at timestamptz NOT NULL,
  value_cents bigint CHECK (value_cents IS NULL OR value_cents >= 0),
  currency    text NOT NULL DEFAULT 'USD',
  status      text NOT NULL CHECK (status IN ('pending','sent','failed','abandoned','skipped')),
  reason      text,
  attempts    integer NOT NULL DEFAULT 0,
  channel     text,                              -- 'api', 'mock' or 'manual_csv'
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL,
  sent_at     timestamptz
);
CREATE INDEX conversion_events_lead_idx ON conversion_events (lead_id);
CREATE INDEX conversion_events_status_idx ON conversion_events (status, provider);

-- Review-request tracking (src/server/nurture/reviews.ts): proves every eligible client was asked.
-- id is 'review-<lead_id>'. Exclusions use written, rule-based codes only, never sentiment.
CREATE TABLE review_requests (
  id               text PRIMARY KEY,
  lead_id          text NOT NULL REFERENCES leads(id),
  matter_type      text NOT NULL,
  anchor_at        timestamptz NOT NULL,         -- signing or closing: the T+0 the offsets count from
  eligible         boolean NOT NULL,
  exclusion_code   text CHECK (exclusion_code IN ('GUARDIANSHIP','OPTOUT','UNIFORM_HOLD','DISPUTE_HOLD','SENSITIVE_TRACK')),
  exclusion_note   text,
  asked_at         timestamptz,
  reminded_at      timestamptz,
  reminder_channel text CHECK (reminder_channel IN ('sms','email')),
  opted_out_at     timestamptz,
  posted_at        timestamptz,                  -- self-reported ("I posted"), never inferred
  created_at       timestamptz NOT NULL,
  CHECK ((eligible AND exclusion_code IS NULL) OR (NOT eligible AND exclusion_code IS NOT NULL))
);
CREATE UNIQUE INDEX review_requests_lead_idx ON review_requests (lead_id);

-- "My family plan" organizer (src/server/services/familyPlan.ts). A visitor signs in with an emailed link and
-- gets a 'planner' session scoped to this one row (app.user_id = the plan id). The email address is not stored,
-- only an HMAC of it. Staff read the summary (counts, ranges, gaps: no names or free text) through the linked
-- lead's access rules; the answers live encrypted (AES-256-GCM, key held by the app) in family_plan_bodies,
-- which has no staff policy at all.
CREATE TABLE family_plans (
  id             text PRIMARY KEY,
  email_hash     text NOT NULL UNIQUE,
  lead_id        text REFERENCES leads(id) ON DELETE SET NULL,
  summary        jsonb NOT NULL,
  sections_done  integer NOT NULL CHECK (sections_done BETWEEN 0 AND 5),
  gap_count      integer NOT NULL CHECK (gap_count >= 0),
  consent        jsonb NOT NULL,               -- {version, at}: the consent text shown when the visitor saved
  prefilled_from text[],
  created_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL
);
CREATE INDEX family_plans_lead_idx ON family_plans (lead_id) WHERE lead_id IS NOT NULL;

CREATE TABLE family_plan_bodies (
  id          text PRIMARY KEY REFERENCES family_plans(id) ON DELETE CASCADE,
  ciphertext  text NOT NULL,
  updated_at  timestamptz NOT NULL
);

-- Used family plan sign-in links (the link token's jti). Inserting an id that is already here fails, so a link
-- works once even with several app instances. No personal data; only the service role touches it.
CREATE TABLE plan_link_uses (
  id       text PRIMARY KEY,
  used_at  timestamptz NOT NULL
);

-- Family plan accounts: the plan row is the account (one per verified email, found by email_hash), and these
-- two tables hold its second factor and its signed-in devices. Both are keyed to the plan and go with it.
-- The TOTP secret is encrypted by the app and bound to the plan id; recovery codes are scrypt hashes.
-- Failed attempts and the lockout are stored here so the limit holds across app instances.
CREATE TABLE plan_mfa (
  id                   text PRIMARY KEY REFERENCES family_plans(id) ON DELETE CASCADE,
  totp_secret_enc      text NOT NULL,
  pending_secret_enc   text,                   -- a replacement authenticator awaiting its first code
  last_used_step       bigint NOT NULL DEFAULT 0,
  recovery_code_hashes text[] NOT NULL DEFAULT '{}',
  enrolled_at          timestamptz,
  failed_attempts      integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until         timestamptz,
  created_at           timestamptz NOT NULL,
  updated_at           timestamptz NOT NULL
);

-- One row per signed-in device. id is the SHA-256 of the cookie's random secret, never the secret itself.
-- Only a coarse device summary ("Safari on iPhone") and an IP prefix (/24 or /48) are kept.
CREATE TABLE plan_sessions (
  id                text PRIMARY KEY,
  plan_id           text NOT NULL REFERENCES family_plans(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL,
  last_seen_at      timestamptz NOT NULL,
  expires_at        timestamptz NOT NULL,
  user_agent        text,
  ip_prefix         text,
  via_recovery_code boolean
);
CREATE INDEX plan_sessions_plan_idx ON plan_sessions (plan_id);

-- Hash-chained, append-only (see src/server/audit/log.ts).
CREATE TABLE audit_events (
  id            text PRIMARY KEY,
  seq           bigint NOT NULL UNIQUE,
  at            timestamptz NOT NULL,
  actor_id      text NOT NULL,
  actor_role    text NOT NULL CHECK (actor_role IN ('platform_admin','intake','marketing','firm_admin','attorney','paralegal','client','planner','system')),
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   text NOT NULL,
  lead_id       text,                          -- deliberately no FK: the trail outlives the lead
  detail        json,                          -- json, not jsonb: the hash covers the exact key order
  prev_hash     text NOT NULL,
  hash          text NOT NULL
);
CREATE INDEX audit_lead_idx ON audit_events (lead_id, seq) WHERE lead_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Session helpers (set per request by the app; unset or empty means "nobody")
-- ---------------------------------------------------------------------------
CREATE FUNCTION app_user_id()   RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;
CREATE FUNCTION app_role()      RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.role', true), '') $$;
CREATE FUNCTION app_firm_id()   RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.firm_id', true), '') $$;
CREATE FUNCTION app_lawyer_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.lawyer_id', true), '') $$;
CREATE FUNCTION app_person_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.person_id', true), '') $$;
CREATE FUNCTION app_supports_lawyer_ids() RETURNS text[] LANGUAGE sql STABLE AS
  $$ SELECT coalesce(string_to_array(nullif(current_setting('app.supports_lawyer_ids', true), ''), ','), '{}'::text[]) $$;

-- Comment visibilities by role (readableVisibilities / writableVisibilities in policy.ts).
CREATE FUNCTION readable_visibilities() RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT CASE app_role()
    WHEN 'platform_admin' THEN ARRAY['internal','firm','client']
    WHEN 'intake'         THEN ARRAY['internal','firm','client']
    WHEN 'client'         THEN ARRAY['client']
    WHEN 'marketing'      THEN ARRAY[]::text[]
    WHEN 'firm_admin'     THEN ARRAY['firm','client']
    WHEN 'attorney'       THEN ARRAY['firm','client']
    WHEN 'paralegal'      THEN ARRAY['firm','client']
    ELSE ARRAY[]::text[]
  END $$;

CREATE FUNCTION writable_visibilities() RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN app_role() = 'client' THEN ARRAY['client'] ELSE readable_visibilities() END $$;

-- Mirrors leadAccess() in policy.ts. SECURITY DEFINER (owned by rls_helper, which
-- bypasses RLS) so the leads policy can call it without recursing into itself.
CREATE FUNCTION lead_access(p_lead_id text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  l leads%ROWTYPE;
  r text := app_role();
BEGIN
  IF r IS NULL OR r = 'marketing' THEN RETURN 'none'; END IF;
  SELECT * INTO l FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN 'none'; END IF;

  IF r = 'platform_admin' THEN
    RETURN 'full';
  ELSIF r = 'intake' THEN
    -- their own queue, or leads nobody has claimed
    IF l.intake_owner_id IS NULL OR l.intake_owner_id = app_user_id() THEN RETURN 'intake'; END IF;
  ELSIF r = 'firm_admin' THEN
    IF app_firm_id() IS NOT NULL AND l.firm_id = app_firm_id() AND l.assigned_lawyer_id IS NOT NULL THEN RETURN 'full'; END IF;
    -- open offer = status 'offered' and not yet expired
    IF app_firm_id() IS NOT NULL AND EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.lead_id = l.id AND a.status = 'offered' AND a.expires_at > now() AND a.firm_id = app_firm_id()
    ) THEN RETURN 'conflict_card'; END IF;
  ELSIF r = 'attorney' THEN
    IF app_lawyer_id() IS NOT NULL AND l.assigned_lawyer_id = app_lawyer_id() THEN RETURN 'full'; END IF;
    IF app_lawyer_id() IS NOT NULL AND EXISTS (
      SELECT 1 FROM assignments a
      WHERE a.lead_id = l.id AND a.status = 'offered' AND a.expires_at > now() AND a.lawyer_id = app_lawyer_id()
    ) THEN RETURN 'conflict_card'; END IF;
  ELSIF r = 'paralegal' THEN
    IF l.assigned_lawyer_id IS NOT NULL AND l.assigned_lawyer_id = ANY (app_supports_lawyer_ids()) THEN RETURN 'full'; END IF;
  ELSIF r = 'client' THEN
    IF app_person_id() IS NOT NULL AND l.person_id = app_person_id() THEN RETURN 'client'; END IF;
  END IF;
  RETURN 'none';
END $$;

-- Lets workers read the chain tip to compute the next hash. No other audit read.
CREATE FUNCTION audit_last() RETURNS TABLE (seq bigint, hash text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS
  $$ SELECT seq, hash FROM audit_events ORDER BY seq DESC LIMIT 1 $$;

-- Immutability triggers --------------------------------------------------------
CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER fee_rule_versions_immutable BEFORE UPDATE OR DELETE ON fee_rule_versions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER fact_verifications_immutable BEFORE UPDATE OR DELETE ON fact_verifications
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER template_approvals_immutable BEFORE UPDATE OR DELETE ON template_approvals
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER page_approvals_immutable BEFORE UPDATE OR DELETE ON page_approvals
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Only the assigned attorney approves an engagement (approve_engagement in policy.ts).
-- Row policies cannot see which column changed, so a trigger guards it for app_user.
CREATE FUNCTION engagement_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'app_user' AND app_role() IS DISTINCT FROM 'attorney' AND (
       (TG_OP = 'INSERT' AND (NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL OR NEW.status <> 'draft'))
    OR (TG_OP = 'UPDATE' AND (NEW.approved_by IS DISTINCT FROM OLD.approved_by
                              OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
                              OR NEW.fee_cents IS DISTINCT FROM OLD.fee_cents
                              OR NEW.package_selection IS DISTINCT FROM OLD.package_selection
                              OR NEW.payment_plan IS DISTINCT FROM OLD.payment_plan
                              OR (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')))
  ) THEN
    RAISE EXCEPTION 'only the assigned attorney can approve an engagement or change its fee' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER engagements_approval_guard BEFORE INSERT OR UPDATE ON engagements
  FOR EACH ROW EXECUTE FUNCTION engagement_approval_guard();

-- A planner may edit their own plan's summary but never which lead it is linked to, or whose email it is:
-- otherwise they could attach their summary to someone else's case. Linking is done by the service role.
CREATE FUNCTION family_plan_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'app_user' AND (
       (TG_OP = 'INSERT' AND NEW.lead_id IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND (NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.email_hash IS DISTINCT FROM OLD.email_hash))
  ) THEN
    RAISE EXCEPTION 'only the server links a family plan to a lead' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER family_plans_owner_guard BEFORE INSERT OR UPDATE ON family_plans
  FOR EACH ROW EXECUTE FUNCTION family_plan_owner_guard();

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
-- Offer stage: the ONLY way a lawyer sees a lead before accepting it. No intake,
-- no persons, no consent. app_user has no SELECT policy path to leads for these viewers.
CREATE VIEW lead_offer_cards WITH (security_barrier = true) AS
  SELECT id, offer_summary, conflict_card, matter_type, state, county, urgent, score
  FROM leads
  WHERE lead_access(id) = 'conflict_card';

-- Clients read their consults without the lawyer's private notes.
CREATE VIEW client_consults WITH (security_barrier = true) AS
  SELECT c.id, c.lead_id, c.lawyer_id, c.at, c.type, c.status, c.outcome
  FROM consults c
  WHERE lead_access(c.lead_id) = 'client';

-- Marketing's only window: counts, no PII, no lead ids.
CREATE VIEW lead_funnel_daily WITH (security_barrier = true) AS
  SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
         stage,
         source ->> 'utm_source' AS utm_source,
         state,
         firm_id,
         count(*) AS leads
  FROM leads
  WHERE app_role() IN ('platform_admin', 'marketing')
     OR (app_role() = 'firm_admin' AND firm_id = app_firm_id())
  GROUP BY 1, 2, 3, 4, 5;

-- Helpers and views read base tables as rls_helper (BYPASSRLS), after their own checks.
ALTER FUNCTION lead_access(text) OWNER TO rls_helper;
ALTER FUNCTION audit_last()      OWNER TO rls_helper;
ALTER VIEW lead_offer_cards      OWNER TO rls_helper;
ALTER VIEW client_consults       OWNER TO rls_helper;
ALTER VIEW lead_funnel_daily     OWNER TO rls_helper;
GRANT SELECT ON leads, assignments, consults, audit_events TO rls_helper;

REVOKE ALL ON FUNCTION lead_access(text), audit_last() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lead_access(text), audit_last() TO app_user, app_service;
GRANT EXECUTE ON FUNCTION app_user_id(), app_role(), app_firm_id(), app_lawyer_id(), app_person_id(),
  app_supports_lawyer_ids(), readable_visibilities(), writable_visibilities() TO app_user, app_service, rls_helper;

-- ---------------------------------------------------------------------------
-- Row-level security: enabled AND forced (the table owner is not exempt)
-- ---------------------------------------------------------------------------
ALTER TABLE firms                ENABLE ROW LEVEL SECURITY;  ALTER TABLE firms                FORCE ROW LEVEL SECURITY;
ALTER TABLE lawyers              ENABLE ROW LEVEL SECURITY;  ALTER TABLE lawyers              FORCE ROW LEVEL SECURITY;
ALTER TABLE persons              ENABLE ROW LEVEL SECURITY;  ALTER TABLE persons              FORCE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;  ALTER TABLE users                FORCE ROW LEVEL SECURITY;
ALTER TABLE leads                ENABLE ROW LEVEL SECURITY;  ALTER TABLE leads                FORCE ROW LEVEL SECURITY;
ALTER TABLE assignments          ENABLE ROW LEVEL SECURITY;  ALTER TABLE assignments          FORCE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;  ALTER TABLE documents            FORCE ROW LEVEL SECURITY;
ALTER TABLE comments             ENABLE ROW LEVEL SECURITY;  ALTER TABLE comments             FORCE ROW LEVEL SECURITY;
ALTER TABLE activities           ENABLE ROW LEVEL SECURITY;  ALTER TABLE activities           FORCE ROW LEVEL SECURITY;
ALTER TABLE consults             ENABLE ROW LEVEL SECURITY;  ALTER TABLE consults             FORCE ROW LEVEL SECURITY;
ALTER TABLE engagements          ENABLE ROW LEVEL SECURITY;  ALTER TABLE engagements          FORCE ROW LEVEL SECURITY;
ALTER TABLE payments             ENABLE ROW LEVEL SECURITY;  ALTER TABLE payments             FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks                ENABLE ROW LEVEL SECURITY;  ALTER TABLE tasks                FORCE ROW LEVEL SECURITY;
ALTER TABLE fee_rule_versions    ENABLE ROW LEVEL SECURITY;  ALTER TABLE fee_rule_versions    FORCE ROW LEVEL SECURITY;
ALTER TABLE billable_events      ENABLE ROW LEVEL SECURITY;  ALTER TABLE billable_events      FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices             ENABLE ROW LEVEL SECURITY;  ALTER TABLE invoices             FORCE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;  ALTER TABLE sequence_enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE suppressions         ENABLE ROW LEVEL SECURITY;  ALTER TABLE suppressions         FORCE ROW LEVEL SECURITY;
ALTER TABLE fact_verifications   ENABLE ROW LEVEL SECURITY;  ALTER TABLE fact_verifications   FORCE ROW LEVEL SECURITY;
ALTER TABLE template_approvals  ENABLE ROW LEVEL SECURITY;  ALTER TABLE template_approvals  FORCE ROW LEVEL SECURITY;
ALTER TABLE page_approvals       ENABLE ROW LEVEL SECURITY;  ALTER TABLE page_approvals       FORCE ROW LEVEL SECURITY;
ALTER TABLE crm_deliveries       ENABLE ROW LEVEL SECURITY;  ALTER TABLE crm_deliveries       FORCE ROW LEVEL SECURITY;
ALTER TABLE seminars             ENABLE ROW LEVEL SECURITY;  ALTER TABLE seminars             FORCE ROW LEVEL SECURITY;
ALTER TABLE partners             ENABLE ROW LEVEL SECURITY;  ALTER TABLE partners             FORCE ROW LEVEL SECURITY;
ALTER TABLE partner_gifts        ENABLE ROW LEVEL SECURITY;  ALTER TABLE partner_gifts        FORCE ROW LEVEL SECURITY;
ALTER TABLE partner_referrals    ENABLE ROW LEVEL SECURITY;  ALTER TABLE partner_referrals    FORCE ROW LEVEL SECURITY;
ALTER TABLE conversion_events    ENABLE ROW LEVEL SECURITY;  ALTER TABLE conversion_events    FORCE ROW LEVEL SECURITY;
ALTER TABLE review_requests      ENABLE ROW LEVEL SECURITY;  ALTER TABLE review_requests      FORCE ROW LEVEL SECURITY;
ALTER TABLE family_plans         ENABLE ROW LEVEL SECURITY;  ALTER TABLE family_plans         FORCE ROW LEVEL SECURITY;
ALTER TABLE family_plan_bodies   ENABLE ROW LEVEL SECURITY;  ALTER TABLE family_plan_bodies   FORCE ROW LEVEL SECURITY;
ALTER TABLE plan_link_uses       ENABLE ROW LEVEL SECURITY;  ALTER TABLE plan_link_uses       FORCE ROW LEVEL SECURITY;
ALTER TABLE plan_mfa             ENABLE ROW LEVEL SECURITY;  ALTER TABLE plan_mfa             FORCE ROW LEVEL SECURITY;
ALTER TABLE plan_sessions        ENABLE ROW LEVEL SECURITY;  ALTER TABLE plan_sessions        FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events         ENABLE ROW LEVEL SECURITY;  ALTER TABLE audit_events         FORCE ROW LEVEL SECURITY;

-- Workers (public intake form, e-sign webhooks, nurture engine, routing) are trusted
-- and get a permissive policy on every client-data table, except where noted below.
-- Everything else in this file is for app_user.
CREATE POLICY service_all ON firms                FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON lawyers              FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON persons              FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON users                FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON leads                FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON assignments          FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON documents            FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON comments             FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON activities           FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON consults             FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON engagements          FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON payments             FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON tasks                FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON billable_events      FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON sequence_enrollments FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON suppressions         FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON crm_deliveries       FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON seminars             FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON partners             FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON partner_gifts        FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON partner_referrals    FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON conversion_events    FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON review_requests      FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON family_plans         FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON family_plan_bodies   FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON plan_link_uses       FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON plan_mfa             FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON plan_sessions        FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_read ON fee_rule_versions   FOR SELECT TO app_service USING (true);
CREATE POLICY service_read ON fact_verifications  FOR SELECT TO app_service USING (true);
CREATE POLICY service_read ON template_approvals FOR SELECT TO app_service USING (true);
CREATE POLICY service_read ON page_approvals      FOR SELECT TO app_service USING (true);
CREATE POLICY service_read ON invoices            FOR SELECT TO app_service USING (true);
CREATE POLICY service_write_invoices ON invoices  FOR INSERT TO app_service WITH CHECK (true);
CREATE POLICY service_append ON audit_events      FOR INSERT TO app_service WITH CHECK (true);

-- firms / lawyers / users ------------------------------------------------------
CREATE POLICY firms_select ON firms FOR SELECT TO app_user
  USING (app_role() = 'platform_admin' OR (id = app_firm_id() AND app_role() IN ('firm_admin','attorney','paralegal')));
CREATE POLICY firms_write ON firms FOR ALL TO app_user
  USING (app_role() = 'platform_admin') WITH CHECK (app_role() = 'platform_admin');

CREATE POLICY lawyers_select ON lawyers FOR SELECT TO app_user USING (
     app_role() IN ('platform_admin','intake')
  OR (app_role() = 'firm_admin' AND firm_id = app_firm_id())
  OR (app_role() = 'attorney'   AND id = app_lawyer_id())
  OR (app_role() = 'paralegal'  AND id = ANY (app_supports_lawyer_ids()))
  -- anyone who can see a lead can see who is handling it (leads RLS applies inside)
  OR EXISTS (SELECT 1 FROM leads l WHERE l.assigned_lawyer_id = lawyers.id)
);
CREATE POLICY lawyers_write ON lawyers FOR ALL TO app_user  -- manage_firm_capacity
  USING (app_role() = 'platform_admin' OR (app_role() = 'firm_admin' AND firm_id = app_firm_id()))
  WITH CHECK (app_role() = 'platform_admin' OR (app_role() = 'firm_admin' AND firm_id = app_firm_id()));

CREATE POLICY users_select ON users FOR SELECT TO app_user
  USING (id = app_user_id() OR app_role() = 'platform_admin' OR (app_role() = 'firm_admin' AND firm_id = app_firm_id()));
CREATE POLICY users_write ON users FOR ALL TO app_user  -- manage_users; firm admins cannot mint staff roles
  USING (app_role() = 'platform_admin' OR (app_role() = 'firm_admin' AND firm_id = app_firm_id() AND role IN ('firm_admin','attorney','paralegal')))
  WITH CHECK (app_role() = 'platform_admin' OR (app_role() = 'firm_admin' AND firm_id = app_firm_id() AND role IN ('firm_admin','attorney','paralegal')));

-- persons: visible with a lead you can read beyond the offer card (leads RLS applies inside)
CREATE POLICY persons_select ON persons FOR SELECT TO app_user
  USING (id = app_person_id() OR EXISTS (SELECT 1 FROM leads l WHERE l.person_id = persons.id));
CREATE POLICY persons_insert ON persons FOR INSERT TO app_user
  WITH CHECK (app_role() IN ('platform_admin','intake'));
CREATE POLICY persons_update ON persons FOR UPDATE TO app_user
  USING (app_role() IN ('platform_admin','intake') AND EXISTS (SELECT 1 FROM leads l WHERE l.person_id = persons.id))
  WITH CHECK (app_role() IN ('platform_admin','intake'));

-- leads ------------------------------------------------------------------------
-- conflict_card viewers are deliberately excluded: they read lead_offer_cards instead.
CREATE POLICY leads_select ON leads FOR SELECT TO app_user
  USING (lead_access(id) IN ('full','intake','client'));
CREATE POLICY leads_insert ON leads FOR INSERT TO app_user
  WITH CHECK (app_role() IN ('platform_admin','intake'));
CREATE POLICY leads_update ON leads FOR UPDATE TO app_user
  USING (lead_access(id) IN ('full','intake'))
  WITH CHECK (lead_access(id) IN ('full','intake'));

-- assignments: attorney own, firm_admin their firm's, platform_admin/intake all.
-- An attorney answers an open offer: offered -> accepted/declined, nothing else.
-- (Setting leads.assigned_lawyer_id on accept is done by the routing worker as app_service.)
CREATE POLICY assignments_select ON assignments FOR SELECT TO app_user USING (
     app_role() IN ('platform_admin','intake')
  OR (app_role() = 'attorney'   AND lawyer_id = app_lawyer_id())
  OR (app_role() = 'firm_admin' AND firm_id = app_firm_id())
);
CREATE POLICY assignments_admin_write ON assignments FOR ALL TO app_user
  USING (app_role() IN ('platform_admin','intake')) WITH CHECK (app_role() IN ('platform_admin','intake'));
CREATE POLICY assignments_respond ON assignments FOR UPDATE TO app_user
  USING (app_role() = 'attorney' AND lawyer_id = app_lawyer_id() AND status = 'offered' AND expires_at > now())
  WITH CHECK (app_role() = 'attorney' AND lawyer_id = app_lawyer_id() AND status IN ('accepted','declined'));

-- documents: full -> all; client -> only client-visible; intake -> none (can upload to unassigned leads).
CREATE POLICY documents_select ON documents FOR SELECT TO app_user USING (
  CASE lead_access(lead_id)
    WHEN 'full'   THEN true
    WHEN 'client' THEN visibility = 'client'
    ELSE false
  END
);
CREATE POLICY documents_insert ON documents FOR INSERT TO app_user WITH CHECK (
  uploaded_by = app_user_id() AND scan_status = 'pending' AND (
       lead_access(lead_id) = 'full'
    OR (lead_access(lead_id) = 'client' AND visibility = 'client')
    OR (lead_access(lead_id) = 'intake' AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_id AND l.assigned_lawyer_id IS NOT NULL))
  )
);
-- Intake can insert but not read documents back: have the app generate the id and not use RETURNING.

-- comments: only on leads past the offer card; visibility per role; authored by the caller.
CREATE POLICY comments_select ON comments FOR SELECT TO app_user USING (
  lead_access(lead_id) IN ('full','intake','client') AND visibility = ANY (readable_visibilities())
);
CREATE POLICY comments_insert ON comments FOR INSERT TO app_user WITH CHECK (
  author_id = app_user_id()
  AND lead_access(lead_id) IN ('full','intake','client')
  AND visibility = ANY (writable_visibilities())
);

-- activities and tasks: staff on the lead (full or intake); clients see neither.
CREATE POLICY activities_select ON activities FOR SELECT TO app_user USING (lead_access(lead_id) IN ('full','intake'));
CREATE POLICY activities_insert ON activities FOR INSERT TO app_user WITH CHECK (lead_access(lead_id) IN ('full','intake'));
CREATE POLICY tasks_all ON tasks FOR ALL TO app_user  -- manage_tasks
  USING (lead_access(lead_id) IN ('full','intake')) WITH CHECK (lead_access(lead_id) IN ('full','intake'));

-- consults: staff via the table; clients via client_consults (no notes). book_consult
-- excludes firm_admin on writes.
CREATE POLICY consults_select ON consults FOR SELECT TO app_user USING (lead_access(lead_id) IN ('full','intake'));
CREATE POLICY consults_write ON consults FOR ALL TO app_user
  USING (lead_access(lead_id) = 'intake' OR (lead_access(lead_id) = 'full' AND app_role() <> 'firm_admin'))
  WITH CHECK (lead_access(lead_id) = 'intake' OR (lead_access(lead_id) = 'full' AND app_role() <> 'firm_admin'));

-- engagements: full -> all; client -> non-draft only; intake -> none.
-- Drafting is attorney/paralegal (approval is guarded by trigger above); signing and
-- payment status changes come from the e-sign webhook as app_service.
CREATE POLICY engagements_select ON engagements FOR SELECT TO app_user USING (
  CASE lead_access(lead_id)
    WHEN 'full'   THEN true
    WHEN 'client' THEN status <> 'draft'
    ELSE false
  END
);
CREATE POLICY engagements_write ON engagements FOR ALL TO app_user
  USING (lead_access(lead_id) = 'full' AND app_role() IN ('attorney','paralegal'))
  WITH CHECK (lead_access(lead_id) = 'full' AND app_role() IN ('attorney','paralegal'));

-- payments: read-only for app_user, same visibility as the engagement (view_engagement): full and
-- client access see them, intake and others do not. Every write (creating a link, recording a
-- webhook, a refund) is made by app_service after the policy.ts check.
CREATE POLICY payments_select ON payments FOR SELECT TO app_user USING (lead_access(lead_id) IN ('full','client'));

-- sequence enrollments: read-only for staff on the lead; workers manage them.
CREATE POLICY enrollments_select ON sequence_enrollments FOR SELECT TO app_user
  USING (lead_access(lead_id) IN ('full','intake'));
CREATE POLICY enrollments_admin ON sequence_enrollments FOR ALL TO app_user
  USING (app_role() = 'platform_admin') WITH CHECK (app_role() = 'platform_admin');

-- suppressions (opt-outs): intake honours "don't call", admins manage.
CREATE POLICY suppressions_staff ON suppressions FOR ALL TO app_user
  USING (app_role() IN ('platform_admin','intake')) WITH CHECK (app_role() IN ('platform_admin','intake'));

-- seminars: marketing and platform admins plan events and enter costs and counts.
CREATE POLICY seminars_marketing ON seminars FOR ALL TO app_user
  USING (app_role() IN ('platform_admin','marketing')) WITH CHECK (app_role() IN ('platform_admin','marketing'));

-- crm_deliveries (lead health page): read-only for admins; platform_admin sees all, firm_admin only their firm's leads.
CREATE POLICY crm_deliveries_select ON crm_deliveries FOR SELECT TO app_user USING (
  app_role() = 'platform_admin'
  OR (app_role() = 'firm_admin' AND lead_access(lead_id) = 'full')
);

-- conversion_events (conversions admin page): read-only for platform_admin and marketing. Ids, status and value only.
CREATE POLICY conversion_events_select ON conversion_events FOR SELECT TO app_user USING (
  app_role() IN ('platform_admin','marketing')
);

-- review_requests (review tracking report): read-only; platform_admin sees all, firm_admin only their firm's leads.
CREATE POLICY review_requests_select ON review_requests FOR SELECT TO app_user USING (
  app_role() = 'platform_admin'
  OR (app_role() = 'firm_admin' AND lead_access(lead_id) = 'full')
);

-- fees: platform_admin only; firm_admin reads their firm's non-draft invoices.
CREATE POLICY fee_rules_admin ON fee_rule_versions FOR ALL TO app_user
  USING (app_role() = 'platform_admin') WITH CHECK (app_role() = 'platform_admin');
CREATE POLICY billable_events_admin ON billable_events FOR ALL TO app_user
  USING (app_role() = 'platform_admin') WITH CHECK (app_role() = 'platform_admin');
CREATE POLICY invoices_admin ON invoices FOR ALL TO app_user
  USING (app_role() = 'platform_admin') WITH CHECK (app_role() = 'platform_admin');
CREATE POLICY invoices_firm_select ON invoices FOR SELECT TO app_user
  USING (app_role() = 'firm_admin' AND firm_id = app_firm_id() AND status <> 'draft');

-- fact verifications (verify_facts): attorneys and platform admins read and approve, as themselves.
CREATE POLICY fact_verifications_select ON fact_verifications FOR SELECT TO app_user
  USING (app_role() IN ('platform_admin','attorney'));
CREATE POLICY fact_verifications_insert ON fact_verifications FOR INSERT TO app_user
  WITH CHECK (app_role() IN ('platform_admin','attorney') AND approved_by = app_user_id());

-- template approvals (approve_templates): attorneys and platform admins read and approve, as themselves.
CREATE POLICY template_approvals_select ON template_approvals FOR SELECT TO app_user
  USING (app_role() IN ('platform_admin','attorney'));
CREATE POLICY template_approvals_insert ON template_approvals FOR INSERT TO app_user
  WITH CHECK (app_role() IN ('platform_admin','attorney') AND approved_by = app_user_id());

-- page approvals (approve_pages): attorneys and platform admins read and approve, as themselves and in their own role.
CREATE POLICY page_approvals_select ON page_approvals FOR SELECT TO app_user
  USING (app_role() IN ('platform_admin','attorney'));
CREATE POLICY page_approvals_insert ON page_approvals FOR INSERT TO app_user
  WITH CHECK (app_role() IN ('platform_admin','attorney') AND approved_by = app_user_id() AND approver_role = app_role());

-- partners (manage_partners): platform_admin sees and manages all; firm_admin only partners of their own firm.
CREATE POLICY partners_admin ON partners FOR ALL TO app_user
  USING (app_role() = 'platform_admin' OR (app_role() = 'firm_admin' AND firm_id IS NOT NULL AND firm_id = app_firm_id()))
  WITH CHECK (app_role() = 'platform_admin' OR (app_role() = 'firm_admin' AND firm_id IS NOT NULL AND firm_id = app_firm_id()));
-- Gifts and referrals follow the partner row: whoever can see the partner can read them. The gift log is insert-only.
CREATE POLICY partner_gifts_select ON partner_gifts FOR SELECT TO app_user
  USING (app_role() IN ('platform_admin','firm_admin') AND EXISTS (SELECT 1 FROM partners p WHERE p.id = partner_id));
CREATE POLICY partner_gifts_insert ON partner_gifts FOR INSERT TO app_user
  WITH CHECK (app_role() IN ('platform_admin','firm_admin') AND EXISTS (SELECT 1 FROM partners p WHERE p.id = partner_id));
CREATE POLICY partner_referrals_select ON partner_referrals FOR SELECT TO app_user
  USING (app_role() IN ('platform_admin','firm_admin') AND EXISTS (SELECT 1 FROM partners p WHERE p.id = partner_id));
CREATE POLICY partner_referrals_update ON partner_referrals FOR UPDATE TO app_user
  USING (app_role() IN ('platform_admin','firm_admin') AND EXISTS (SELECT 1 FROM partners p WHERE p.id = partner_id))
  WITH CHECK (app_role() IN ('platform_admin','firm_admin') AND EXISTS (SELECT 1 FROM partners p WHERE p.id = partner_id));

-- family plans: a planner session sees and changes only its own row (app.user_id is the plan id).
-- Staff read the summary row of a plan linked to a lead they have full or intake access to; clients and
-- marketing have no path. The encrypted answers are the owner's alone: no staff policy on family_plan_bodies.
CREATE POLICY family_plans_owner ON family_plans FOR ALL TO app_user
  USING (app_role() = 'planner' AND id = app_user_id())
  WITH CHECK (app_role() = 'planner' AND id = app_user_id());
CREATE POLICY family_plans_staff_select ON family_plans FOR SELECT TO app_user
  USING (lead_id IS NOT NULL AND app_role() IN ('platform_admin','intake','firm_admin','attorney','paralegal')
         AND lead_access(lead_id) IN ('full','intake'));
CREATE POLICY family_plan_bodies_owner ON family_plan_bodies FOR ALL TO app_user
  USING (app_role() = 'planner' AND id = app_user_id())
  WITH CHECK (app_role() = 'planner' AND id = app_user_id());

-- Family plan accounts: the second factor and the device list are the owner's alone. A planner session sees
-- and changes only its own rows; no staff role has any policy here, so staff (even platform_admin) see nothing.
-- Creating the second factor happens before a session exists, so only the service role may INSERT plan_mfa
-- (no app_user INSERT grant); sign-ins likewise create plan_sessions rows as the service role.
CREATE POLICY plan_mfa_owner ON plan_mfa FOR ALL TO app_user
  USING (app_role() = 'planner' AND id = app_user_id())
  WITH CHECK (app_role() = 'planner' AND id = app_user_id());
CREATE POLICY plan_sessions_owner ON plan_sessions FOR ALL TO app_user
  USING (app_role() = 'planner' AND plan_id = app_user_id())
  WITH CHECK (app_role() = 'planner' AND plan_id = app_user_id());

-- audit: insert-only for everyone; read by platform_admin, and firm_admin for their leads.
-- A planner reads the events about its own account (resource family_plan, id = its plan id), for the
-- activity list on /my-plan/account. Those events carry ids and counts only.
CREATE POLICY audit_insert ON audit_events FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY audit_select ON audit_events FOR SELECT TO app_user USING (
  app_role() = 'platform_admin'
  OR (app_role() = 'firm_admin' AND lead_id IS NOT NULL AND lead_access(lead_id) = 'full')
  OR (app_role() = 'planner' AND resource_type = 'family_plan' AND resource_id = app_user_id())
);

-- ---------------------------------------------------------------------------
-- Privileges (RLS filters rows; grants bound what statements exist at all)
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, app_user, app_service;
REVOKE ALL ON lead_offer_cards, client_consults, lead_funnel_daily FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON firms, lawyers, persons, users, tasks, suppressions TO app_user;
GRANT SELECT, INSERT, UPDATE         ON leads, assignments, consults, engagements TO app_user;
GRANT SELECT                         ON payments TO app_user;
GRANT SELECT, INSERT                 ON documents, comments, activities, invoices, billable_events, fee_rule_versions TO app_user;
GRANT SELECT, INSERT                 ON fact_verifications TO app_user;
GRANT SELECT, INSERT                 ON template_approvals TO app_user;
GRANT SELECT, INSERT                 ON page_approvals TO app_user;
GRANT SELECT, INSERT, UPDATE         ON partners TO app_user;
GRANT SELECT, INSERT                 ON partner_gifts TO app_user;
GRANT SELECT, UPDATE                 ON partner_referrals TO app_user;
GRANT UPDATE                         ON invoices TO app_user;
GRANT SELECT, INSERT, UPDATE         ON sequence_enrollments TO app_user;
GRANT SELECT, INSERT, UPDATE         ON seminars TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON family_plans, family_plan_bodies TO app_user;
GRANT SELECT, UPDATE, DELETE         ON plan_mfa TO app_user;       -- planner rows only (policy above); no INSERT
GRANT SELECT, UPDATE, DELETE         ON plan_sessions TO app_user;  -- planner rows only (policy above); no INSERT
GRANT SELECT                         ON lead_offer_cards, client_consults, lead_funnel_daily, crm_deliveries, conversion_events, review_requests TO app_user;

-- Audit trail: INSERT only. No SELECT/UPDATE/DELETE/TRUNCATE grant to the app at all
-- except SELECT for the platform_admin/firm_admin policy above.
GRANT SELECT, INSERT ON audit_events TO app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC, app_user, app_service;
REVOKE UPDATE, DELETE, TRUNCATE ON fee_rule_versions FROM PUBLIC, app_user, app_service;
REVOKE UPDATE, DELETE, TRUNCATE ON fact_verifications FROM PUBLIC, app_user, app_service;
REVOKE UPDATE, DELETE, TRUNCATE ON template_approvals FROM PUBLIC, app_user, app_service;
REVOKE UPDATE, DELETE, TRUNCATE ON page_approvals FROM PUBLIC, app_user, app_service;

GRANT SELECT, INSERT, UPDATE, DELETE ON firms, lawyers, persons, users, leads, assignments, documents, comments,
  activities, consults, engagements, payments, tasks, billable_events, sequence_enrollments, suppressions TO app_service;
GRANT SELECT, INSERT, UPDATE ON crm_deliveries TO app_service;
GRANT SELECT, INSERT, UPDATE ON seminars TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON family_plans, family_plan_bodies TO app_service;
GRANT SELECT, INSERT ON plan_link_uses TO app_service; -- app_user has no grant at all
GRANT SELECT, INSERT, UPDATE, DELETE ON plan_mfa, plan_sessions TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON partners, partner_referrals TO app_service;
GRANT SELECT, INSERT ON partner_gifts TO app_service;
GRANT SELECT, INSERT, UPDATE ON crm_deliveries, conversion_events, review_requests TO app_service;
GRANT SELECT, INSERT ON invoices TO app_service;
GRANT SELECT ON fee_rule_versions TO app_service;
GRANT SELECT ON fact_verifications TO app_service; -- approvals are written in the approver's own session
GRANT SELECT ON template_approvals TO app_service; -- the sender reads approvals; they are written in the approver's own session
GRANT SELECT ON page_approvals TO app_service; -- the apply script and export read them; written in the approver's own session
GRANT INSERT ON audit_events TO app_service;

-- The automation runner reads the audit log as its event feed (ids and actions only).
GRANT SELECT ON audit_events TO app_service;
CREATE POLICY audit_events_service_read ON audit_events FOR SELECT TO app_service USING (true);
GRANT SELECT, INSERT, UPDATE ON automation_state TO app_service;

-- Only the service role reads or writes second-factor secrets; app_user has no grant at all.
ALTER TABLE user_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mfa FORCE ROW LEVEL SECURITY;
CREATE POLICY user_mfa_service ON user_mfa FOR ALL TO app_service USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON user_mfa TO app_service;

COMMIT;
