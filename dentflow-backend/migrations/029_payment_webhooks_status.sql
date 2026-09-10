-- ============================================================
-- MIGRATION 029: Webhook status allow PERMANENTLY_FAILED
-- ============================================================
-- Root cause (TD-PAY-023): migration 001 mendefinisikan
--   payment_webhooks.status CHECK (IN 'RECEIVED','PROCESSED','FAILED')
-- dan migration 009 (CREATE TABLE IF NOT EXISTS) TIDAK mengubah
-- constraint yang sudah ada. Akibatnya:
--   markPermanentlyFailed() menyetel status 'PERMANENTLY_FAILED'
--   -> melanggar check constraint -> retry job melempar di tengah loop
--   -> semua webhook retry berikutnya di run yang sama tidak diproses.
-- Perbaikan: drop constraint lama & buat ulang dengan PERMANENTLY_FAILED.

ALTER TABLE payment_webhooks DROP CONSTRAINT IF EXISTS payment_webhooks_status_check;

ALTER TABLE payment_webhooks
    ADD CONSTRAINT payment_webhooks_status_check
    CHECK (status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'PERMANENTLY_FAILED'));