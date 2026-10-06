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
  document_ids         text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX engagements_lead_idx   ON engagements (lead_id);
CREATE INDEX engagements_lawyer_idx ON engagements (lawyer_id, status);

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

-- Hash-chained, append-only (see src/server/audit/log.ts).
CREATE TABLE audit_events (
  id            text PRIMARY KEY,
  seq           bigint NOT NULL UNIQUE,
  at            timestamptz NOT NULL,
  actor_id      text NOT NULL,
  actor_role    text NOT NULL CHECK (actor_role IN ('platform_admin','intake','marketing','firm_admin','attorney','paralegal','client','system')),
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

-- Only the assigned attorney approves an engagement (approve_engagement in policy.ts).
-- Row policies cannot see which column changed, so a trigger guards it for app_user.
CREATE FUNCTION engagement_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'app_user' AND app_role() IS DISTINCT FROM 'attorney' AND (
       (TG_OP = 'INSERT' AND (NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL OR NEW.status <> 'draft'))
    OR (TG_OP = 'UPDATE' AND (NEW.approved_by IS DISTINCT FROM OLD.approved_by
                              OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
                              OR NEW.fee_cents IS DISTINCT FROM OLD.fee_cents
                              OR (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')))
  ) THEN
    RAISE EXCEPTION 'only the assigned attorney can approve an engagement or change its fee' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER engagements_approval_guard BEFORE INSERT OR UPDATE ON engagements
  FOR EACH ROW EXECUTE FUNCTION engagement_approval_guard();

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
ALTER TABLE tasks                ENABLE ROW LEVEL SECURITY;  ALTER TABLE tasks                FORCE ROW LEVEL SECURITY;
ALTER TABLE fee_rule_versions    ENABLE ROW LEVEL SECURITY;  ALTER TABLE fee_rule_versions    FORCE ROW LEVEL SECURITY;
ALTER TABLE billable_events      ENABLE ROW LEVEL SECURITY;  ALTER TABLE billable_events      FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices             ENABLE ROW LEVEL SECURITY;  ALTER TABLE invoices             FORCE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;  ALTER TABLE sequence_enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE suppressions         ENABLE ROW LEVEL SECURITY;  ALTER TABLE suppressions         FORCE ROW LEVEL SECURITY;
ALTER TABLE fact_verifications   ENABLE ROW LEVEL SECURITY;  ALTER TABLE fact_verifications   FORCE ROW LEVEL SECURITY;
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
CREATE POLICY service_all ON tasks                FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON billable_events      FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON sequence_enrollments FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_all ON suppressions         FOR ALL TO app_service USING (true) WITH CHECK (true);
CREATE POLICY service_read ON fee_rule_versions   FOR SELECT TO app_service USING (true);
CREATE POLICY service_read ON fact_verifications  FOR SELECT TO app_service USING (true);
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

-- sequence enrollments: read-only for staff on the lead; workers manage them.
CREATE POLICY enrollments_select ON sequence_enrollments FOR SELECT TO app_user
  USING (lead_access(lead_id) IN ('full','intake'));
CREATE POLICY enrollments_admin ON sequence_enrollments FOR ALL TO app_user
  USING (app_role() = 'platform_admin') WITH CHECK (app_role() = 'platform_admin');

-- suppressions (opt-outs): intake honours "don't call", admins manage.
CREATE POLICY suppressions_staff ON suppressions FOR ALL TO app_user
  USING (app_role() IN ('platform_admin','intake')) WITH CHECK (app_role() IN ('platform_admin','intake'));

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

-- audit: insert-only for everyone; read by platform_admin, and firm_admin for their leads.
CREATE POLICY audit_insert ON audit_events FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY audit_select ON audit_events FOR SELECT TO app_user USING (
  app_role() = 'platform_admin'
  OR (app_role() = 'firm_admin' AND lead_id IS NOT NULL AND lead_access(lead_id) = 'full')
);

-- ---------------------------------------------------------------------------
-- Privileges (RLS filters rows; grants bound what statements exist at all)
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, app_user, app_service;
REVOKE ALL ON lead_offer_cards, client_consults, lead_funnel_daily FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON firms, lawyers, persons, users, tasks, suppressions TO app_user;
GRANT SELECT, INSERT, UPDATE         ON leads, assignments, consults, engagements TO app_user;
GRANT SELECT, INSERT                 ON documents, comments, activities, invoices, billable_events, fee_rule_versions TO app_user;
GRANT SELECT, INSERT                 ON fact_verifications TO app_user;
GRANT UPDATE                         ON invoices TO app_user;
GRANT SELECT, INSERT, UPDATE         ON sequence_enrollments TO app_user;
GRANT SELECT                         ON lead_offer_cards, client_consults, lead_funnel_daily TO app_user;

-- Audit trail: INSERT only. No SELECT/UPDATE/DELETE/TRUNCATE grant to the app at all
-- except SELECT for the platform_admin/firm_admin policy above.
GRANT SELECT, INSERT ON audit_events TO app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC, app_user, app_service;
REVOKE UPDATE, DELETE, TRUNCATE ON fee_rule_versions FROM PUBLIC, app_user, app_service;
REVOKE UPDATE, DELETE, TRUNCATE ON fact_verifications FROM PUBLIC, app_user, app_service;

GRANT SELECT, INSERT, UPDATE, DELETE ON firms, lawyers, persons, users, leads, assignments, documents, comments,
  activities, consults, engagements, tasks, billable_events, sequence_enrollments, suppressions TO app_service;
GRANT SELECT, INSERT ON invoices TO app_service;
GRANT SELECT ON fee_rule_versions TO app_service;
GRANT SELECT ON fact_verifications TO app_service; -- approvals are written in the approver's own session
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
