-- ============================================
-- DRAFT — BELUM APPLY (extension .sql.draft di-skip migrate.ts)
-- Migration 032: Postgres queue_sequences (replace Redis INCR)
-- Task 2.4.2a design — apply dulu di Task 2.4.3 (C1/C2/W2) per MIGRATION_PLAN.md
-- Corrections hasil audit 2.4.2a:
--   * branch_id VARCHAR(1) -> UUID (queues.branch_id UUID NOT NULL, migrasi 001)
--   * p_date DEFAULT CURRENT_DATE (konsisten Redis key queue:{...}:{YYYYMMDD})
--   * tambah get_current_queue_number (tanpa increment, parity Express)
-- ============================================

-- Option B: Table-based atomic counter (upsert pattern)
CREATE TABLE IF NOT EXISTS queue_sequences (
  branch_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  sequence_date DATE NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (branch_id, doctor_id, sequence_date)
);

CREATE INDEX IF NOT EXISTS idx_queue_sequences_branch_date
  ON queue_sequences(branch_id, sequence_date);

-- Atomic function: increment + return next number (replaces redis.incr)
CREATE OR REPLACE FUNCTION get_next_queue_number(
  p_branch_id UUID,
  p_doctor_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO queue_sequences (branch_id, doctor_id, sequence_date, current_number)
  VALUES (p_branch_id, p_doctor_id, p_date, 1)
  ON CONFLICT (branch_id, doctor_id, sequence_date)
  DO UPDATE SET
    current_number = queue_sequences.current_number + 1,
    updated_at = CURRENT_TIMESTAMP
  RETURNING current_number INTO v_next;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Read-only: current queue number tanpa increment (parity QueueService.getCurrentQueueNumber)
CREATE OR REPLACE FUNCTION get_current_queue_number(
  p_branch_id UUID,
  p_doctor_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
  v_current INTEGER;
BEGIN
  SELECT current_number INTO v_current
    FROM queue_sequences
   WHERE branch_id = p_branch_id
     AND doctor_id = p_doctor_id
     AND sequence_date = p_date;
  RETURN COALESCE(v_current, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Serverless pakai service role key -> grant ke service_role + authenticated
GRANT EXECUTE ON FUNCTION get_next_queue_number(UUID, UUID, DATE) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_current_queue_number(UUID, UUID, DATE) TO service_role, authenticated;

-- ============================================
-- OPTIONAL (comment dulu, jangan aktif kalau belum yakin data contoh):
-- Seed counter dari data queues existing (initialize per hari maksimal sekarang):
--   INSERT INTO queue_sequences (branch_id, doctor_id, sequence_date, current_number)
--   SELECT q.branch_id, q.doctor_id, q.created_at::date, MAX(q.queue_number)
--     FROM queues q
--    WHERE q.deleted_at IS NULL
--    GROUP BY q.branch_id, q.doctor_id, q.created_at::date
--    ON CONFLICT (branch_id, doctor_id, sequence_date) DO NOTHING;
-- ============================================

-- NOTE (draft design, bukan SQL):
-- * Per (branch_id, doctor_id, date) counter reset harian — match queue.service.ts Redis key.
-- * Upsert sudah atomic (INSERT..ON CONFLICT..RETURNING) — no setval/pgext needed.
-- * Cleanup retention 30 hari (opsional, jalankan di cron/scheduled):
--     DELETE FROM queue_sequences WHERE sequence_date < CURRENT_DATE - 30;
-- * Serverless pattern:
--     supabase.rpc('get_next_queue_number', { p_branch_id, p_doctor_id, p_date })