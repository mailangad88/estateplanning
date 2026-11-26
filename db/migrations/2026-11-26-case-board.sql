-- 2026-11-26 case board: per-case paralegal assignment, the legal steps after payment, the intake questionnaire and paralegal commission.
-- For a database created from db/schema.sql before this date (for example the live Neon database set up
-- from neon-setup.sql). Run once as the schema owner, before deploying the code that reads these columns:
--   psql "$DATABASE_URL_OWNER" -v ON_ERROR_STOP=1 -f db/migrations/2026-11-26-case-board.sql
-- Safe to run twice. A database created from the current db/schema.sql already has all of this.
BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_paralegal_id text REFERENCES users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS case_steps jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS questionnaire jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS commission jsonb;
CREATE INDEX IF NOT EXISTS leads_paralegal_idx ON leads (assigned_paralegal_id) WHERE assigned_paralegal_id IS NOT NULL;

-- Paralegals now see only the cases assigned to them (was: every case of the attorneys they support).
CREATE OR REPLACE FUNCTION lead_access(p_lead_id text) RETURNS text
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
    -- only the cases assigned to them (isCaseParalegal in policy.ts)
    IF l.assigned_lawyer_id IS NOT NULL AND l.assigned_paralegal_id IS NOT NULL AND l.assigned_paralegal_id = app_user_id() THEN RETURN 'full'; END IF;
  ELSIF r = 'client' THEN
    IF app_person_id() IS NOT NULL AND l.person_id = app_person_id() THEN RETURN 'client'; END IF;
  END IF;
  RETURN 'none';
END $$;

-- Attorneys and paralegals see their own firm's staff (names on the case board, the paralegal picker).
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT TO app_user
  USING (id = app_user_id() OR app_role() = 'platform_admin' OR (app_role() = 'firm_admin' AND firm_id = app_firm_id())
         -- the case team sees its own firm's staff (names on the case board, the paralegal picker)
         OR (app_role() IN ('attorney','paralegal') AND firm_id = app_firm_id() AND role IN ('firm_admin','attorney','paralegal')));

COMMIT;
