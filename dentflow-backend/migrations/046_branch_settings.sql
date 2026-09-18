-- Migration 046: branch_settings table (Batch 6.2)
-- Refs: TD-2.4.41 (runner not atomic — self-wrap BEGIN/COMMIT),
--       migration 045 RLS pattern, migration 044 inventory pattern.
-- Backup baseline sebelum apply.

BEGIN;

CREATE TABLE IF NOT EXISTS branch_settings (
  branch_id UUID PRIMARY KEY REFERENCES branches(id) ON DELETE RESTRICT,
  clinic JSONB NOT NULL DEFAULT '{}'::jsonb,
  hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment JSONB NOT NULL DEFAULT '{}'::jsonb,
  notifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed defaults untuk 3 branch (idempotent — ON CONFLICT DO NOTHING)
INSERT INTO branch_settings (branch_id, clinic, hours, notifications, payment)
SELECT
  b.id,
  jsonb_build_object(
    'branchName', b.name,
    'address', COALESCE(b.address, ''),
    'phone', COALESCE(b.phone, ''),
    'email', ''
  ),
  jsonb_build_object(
    'openTime', '08:00',
    'closeTime', '17:00',
    'breakStart', '12:00',
    'breakEnd', '13:00',
    'daysOpen', jsonb_build_array('mon','tue','wed','thu','fri','sat')
  ),
  jsonb_build_object('emailReminders', true, 'smsGateway', false),
  jsonb_build_object(
    'midtransClientKey', '',
    'midtransServerKey', '',
    'midtransWebhookUrl', ''
  )
FROM branches b
ON CONFLICT (branch_id) DO NOTHING;

-- RLS hardening (pattern 044/045)
ALTER TABLE branch_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE branch_settings FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE branch_settings TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_branch_settings_updated_at
  ON branch_settings(updated_at DESC);

DO $$ BEGIN RAISE NOTICE 'Migration 046 applied: branch_settings table + 3 seed rows'; END $$;

COMMIT;

-- Rollback (comment, tidak apply):
-- BEGIN;
-- DROP TABLE IF EXISTS branch_settings;
-- COMMIT;