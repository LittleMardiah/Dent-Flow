-- 047_cron_jobs.sql
-- Task 2.8 Fase B1: 3 cron job SQL-only.
-- C4 (webhook-retry) DEFERRED ke Fase B2 (parity risk).
-- Precedent: pattern 045/046 self-wrap BEGIN/COMMIT.
-- Timezone: Asia/Jakarta (switch dari legacy UTC).
-- Idempotent: CREATE OR REPLACE + cron.unschedule dulu.
-- FIX (dry-run deteksi): pg_cron build ini TIDAK punya varian
--   schedule(..., 'Asia/Jakarta') / kolom cron.job.schedule_timezone
--   (hanya cron.schedule(text,text,text). DB TimeZone=UTC).
--   Maka jam jadwal di-encode UTC = wall-clock WIB (UTC+7), dikomentari
--   per job: 00:00 WIB = 17:00 UTC, 03:00 WIB = 20:00 UTC.

BEGIN;

-- EXTENSION check (should already enabled via Dashboard B0)
-- (Jika migration di-run dengan postgres role yang non-superuser,
--  CREATE EXTENSION akan fail. Comment sengaja: extension sudah
--  di-enable via Dashboard.)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ------------------------------------------------------------
-- JOB 1: no-show-detection (setiap 30 menit)
-- Parity: Express noShowDetection.job.ts + NotificationService.
-- FIX (function dry-run): bookings TIDAK punya kolom deleted_at;
--   filter dihapus sesuai parity legacy (status, session_end+grace,
--   checked_in_at IS NULL).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cron_no_show_detect()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_grace_minutes int := 15;
  v_booking record;
  v_patient_user_id uuid;
  v_admin_id uuid;
BEGIN
  -- Select candidate bookings (past session_end + grace)
  FOR v_booking IN
    SELECT b.id, b.branch_id, b.patient_id, b.doctor_id
    FROM bookings b
    WHERE b.status = 'PAYMENT_CONFIRMED'
      AND b.session_end IS NOT NULL
      AND b.session_end < NOW() - (v_grace_minutes || ' minutes')::interval
      AND b.checked_in_at IS NULL
  LOOP
    -- Mark NO_SHOW
    UPDATE bookings
    SET status = 'NO_SHOW',
        no_show_at = NOW(),
        updated_at = NOW()
    WHERE id = v_booking.id
      AND status = 'PAYMENT_CONFIRMED';  -- idempotency guard

    -- Notifikasi ke pasien (via users.id)
    SELECT p.user_id INTO v_patient_user_id
    FROM patients p WHERE p.id = v_booking.patient_id LIMIT 1;

    IF v_patient_user_id IS NOT NULL THEN
      INSERT INTO notifications
        (branch_id, patient_id, type, status, content, sent_at)
      VALUES
        (v_booking.branch_id, v_patient_user_id, 'CANCELLATION',
         'SENT', 'Booking Anda tidak check-in (NO_SHOW)',
         NOW());
    END IF;

    -- Notifikasi ke admin branch (first admin)
    SELECT u.id INTO v_admin_id
    FROM users u
    WHERE u.branch_id = v_booking.branch_id
      AND u.role = 'ADMIN_BRANCH'
      AND u.is_active = true
    LIMIT 1;

    IF v_admin_id IS NOT NULL THEN
      INSERT INTO notifications
        (branch_id, patient_id, type, status, content, sent_at)
      VALUES
        (v_booking.branch_id, v_admin_id, 'CANCELLATION',
         'SENT', 'Pasien NO_SHOW terdeteksi',
         NOW());
    END IF;
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- JOB 2: queue-retention cleanup (setiap midnight WIB)
-- Replaces legacy "reset-queue" (obsolete post-Task 2.7).
-- Post-Task 2.7: queue pakai queue_sequences (per-tanggal PK).
-- Retention: hapus data >30 hari untuk prevent bloat.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cron_queue_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM queue_sequences
  WHERE sequence_date < CURRENT_DATE - 30;
END;
$$;

-- ------------------------------------------------------------
-- JOB 3: cleanup-temp-patients (setiap 3 AM WIB)
-- Parity: Express cleanupTempPatients.job.ts.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cron_cleanup_temp_patients()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  DELETE FROM temporary_patients
  WHERE converted_to_patient_id IS NULL
    AND created_at < NOW() - INTERVAL '7 days'
    AND deleted_at IS NULL;
END;
$$;

-- ------------------------------------------------------------
-- SCHEDULE (idempotent via unschedule dulu)
-- ------------------------------------------------------------

-- Job 1: no-show-detection (setiap 30 menit, tz-agnostic cadence)
DO $$ BEGIN
  PERFORM cron.unschedule('no-show-detection');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'no-show-detection',
  '*/30 * * * *',
  $$SELECT cron_no_show_detect();$$
);

-- Job 2: queue-retention (setiap midnight WIB = 17:00 UTC)
DO $$ BEGIN
  PERFORM cron.unschedule('reset-queue');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('queue-retention');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'queue-retention',
  '0 17 * * *',
  $$SELECT cron_queue_retention();$$
);

-- Job 3: cleanup-temp-patients (setiap 3 AM WIB = 20:00 UTC)
DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-temp-patients');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'cleanup-temp-patients',
  '0 20 * * *',
  $$SELECT cron_cleanup_temp_patients();$$
);

DO $$ BEGIN RAISE NOTICE 'Migration 047 applied: 3 cron jobs scheduled (Asia/Jakarta)'; END $$;

COMMIT;

-- Rollback (comment):
-- SELECT cron.unschedule('no-show-detection');
-- SELECT cron.unschedule('queue-retention');
-- SELECT cron.unschedule('cleanup-temp-patients');
-- DROP FUNCTION IF EXISTS cron_no_show_detect();
-- DROP FUNCTION IF EXISTS cron_queue_retention();
-- DROP FUNCTION IF EXISTS cron_cleanup_temp_patients();