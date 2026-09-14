-- ============================================
-- Migration 033: bookings.patient_id DROP NOT NULL
-- Task 2.4.3b-PREP2 — fix W2 walk-in blocker
-- ============================================
-- Root cause: migration 001 declared patient_id UUID NOT NULL.
-- Migration 014 added temp_patient_id tapi TIDAK drop NOT NULL.
-- Akibat: walk-in booking (patient_id=NULL, temp_patient_id=<uuid>)
--         GAGAL di Express W2 (pre-existing bug).
-- Fix: DROP NOT NULL. Walk-in patient pakai temp_patient_id, bukan patient_id.
-- Safety: DROP NOT NULL idempotent; existing rows (semua punya patient_id) TIDAK terpengaruh.
-- TD-2.4.11: Express W2 pre-existing broken (insert NULL to NOT NULL column).

ALTER TABLE bookings
  ALTER COLUMN patient_id DROP NOT NULL;

-- Verify log
DO $$
BEGIN
  RAISE NOTICE 'Migration 033 applied: bookings.patient_id now nullable';
END $$;