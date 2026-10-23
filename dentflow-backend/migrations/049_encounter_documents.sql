-- Migration 049: encounter_documents — storage backend alignment (Silo/MinIO)
--
-- Reconciliation note (R2: kode = source of truth):
--   Table `encounter_documents` sudah dibuat oleh migration 048 dengan schema
--   canonical yang juga dipakai serverless + web:
--     id, encounter_id, patient_id, bucket, path, original_name, mime,
--     size_bytes, uploaded_by, created_at, deleted_at
--
--   Prompt 049 meminta kolom filename/mimetype/size, tetapi mapping-nya sudah
--   tersedia di schema 048:
--     filename   -> path (object key di bucket)
--     mimetype   -> mime
--     size       -> size_bytes
--
--   Migration ini TIDAK men-drop/mengubah kolom 048 (menghindari breaking
--   change untuk serverless + web). Fungsinya: guard idempotent agar backend
--   Express tidak jalan di atas schema yang salah pada database fresh/local.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.encounter_documents') IS NULL THEN
    RAISE EXCEPTION 'encounter_documents belum ada — jalankan migration 048 terlebih dahulu';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'encounter_documents'
      AND column_name = 'path'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'encounter_documents'
      AND column_name = 'mime'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'encounter_documents'
      AND column_name = 'size_bytes'
  ) THEN
    RAISE EXCEPTION 'encounter_documents schema tidak sesuai canonical 048 (path/mime/size_bytes)';
  END IF;

  RAISE NOTICE 'Migration 049 validated: encounter_documents canonical schema (048) siap dipakai Silo backend';
END $$;

COMMIT;

-- Rollback (comment, tidak apply):
-- Migration ini tidak mengubah DDL; tidak ada rollback yang diperlukan.
