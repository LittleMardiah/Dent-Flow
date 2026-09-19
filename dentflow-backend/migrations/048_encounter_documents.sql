-- Migration 048: encounter_documents table (Task 2.10 Fase B1)
-- MinIO -> Supabase Storage. Bucket 'dentflow' (private) created at B0.
-- Refs: pattern 045/046 self-wrap BEGIN/COMMIT; RLS hardening ENABLE +
--       REVOKE anon/public + GRANT authenticated/service_role.
-- Design: private bucket + signed URL via service_role (custom JWT backend
--         -> RLS auth.uid() tidak bisa dipakai). Server-side validation:
--         size <= 4MB, MIME whitelist, ownership via branch scope.

BEGIN;

CREATE TABLE IF NOT EXISTS encounter_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  bucket TEXT NOT NULL DEFAULT 'dentflow',
  path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_encounter_documents_encounter_id
  ON encounter_documents(encounter_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_encounter_documents_patient_id
  ON encounter_documents(patient_id) WHERE deleted_at IS NULL;

-- RLS hardening (pattern 044/045/046)
ALTER TABLE encounter_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE encounter_documents FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE encounter_documents
  TO authenticated, service_role;

DO $$ BEGIN RAISE NOTICE 'Migration 048 applied: encounter_documents'; END $$;

COMMIT;

-- Rollback (comment, tidak apply):
-- BEGIN;
-- DROP TABLE IF EXISTS encounter_documents;
-- COMMIT;