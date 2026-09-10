-- ============================================
-- MIGRATION 028: Patients Soft Delete
-- Pasien tidak dihapus permanen, hanya di-flag deleted_at
-- ============================================

ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_patients_deleted_at ON patients(deleted_at);