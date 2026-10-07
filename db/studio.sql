-- Social video studio (src/server/studio). Separate from schema.sql so the portal schema
-- and the studio can change independently. Only the service role touches these tables;
-- access is checked in src/server/studio/access.ts. Apply after schema.sql:
--   psql "$DATABASE_URL" -f db/studio.sql

CREATE TABLE IF NOT EXISTS studio_videos (
  id          text PRIMARY KEY,
  stage       text NOT NULL,
  format      text NOT NULL CHECK (format IN ('long', 'short')),
  slot_at     timestamptz,
  doc         jsonb NOT NULL,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS studio_videos_stage ON studio_videos (stage, slot_at);

-- One row per platform. doc.sealedTokens is AES-GCM sealed with STUDIO_TOKEN_KEY.
CREATE TABLE IF NOT EXISTS studio_channels (
  platform    text PRIMARY KEY CHECK (platform IN ('youtube', 'instagram')),
  doc         jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS studio_settings (
  id          text PRIMARY KEY CHECK (id = 'settings'),
  doc         jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE studio_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON studio_videos, studio_channels, studio_settings TO app_service;
    DROP POLICY IF EXISTS studio_videos_service ON studio_videos;
    CREATE POLICY studio_videos_service ON studio_videos TO app_service USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS studio_channels_service ON studio_channels;
    CREATE POLICY studio_channels_service ON studio_channels TO app_service USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS studio_settings_service ON studio_settings;
    CREATE POLICY studio_settings_service ON studio_settings TO app_service USING (true) WITH CHECK (true);
  END IF;
END $$;
