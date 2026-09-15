-- ============================================
-- Migration 040: DROP duplicate trigger trg_invoice_payment_log
-- Task 4b-1-PREREQ (fix F1 dari pre-audit 4b-1)
-- ============================================
-- Root cause: migration 005 buat trg_invoice_payment_log;
-- migration 023 buat trg_log_invoice_payment (supersede, fungsi sama).
-- Keduanya AKTIF -> double INSERT -> UNIQUE violation.
-- Fix: drop 005 yang sudah superseded.

DROP TRIGGER IF EXISTS trg_invoice_payment_log ON invoices;

-- Verify log
DO $$ BEGIN
  RAISE NOTICE 'Migration 040 applied: trg_invoice_payment_log dropped';
END $$;