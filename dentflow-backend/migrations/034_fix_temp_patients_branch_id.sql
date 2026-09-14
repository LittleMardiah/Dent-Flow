-- ============================================
-- Migration 034: temporary_patients.branch_id VARCHAR(1) -> UUID
-- Task 2.4.3b-FIX2 — fix RC2 (C2 walk-in blocker)
-- ============================================
-- Root cause: migration 014 declared branch_id VARCHAR(1) CHECK IN ('A','B','C')
-- (legacy char-based). Semua tabel lain pakai UUID (branches.id).
-- Akibat: serverless C2 insert UUID -> PG error 22001
-- ('value too long for type character varying(1)').
--
-- Fix: map legacy chars to real branch UUIDs, then ALTER TYPE.
-- Safety: ABORT if unmappable branch_id values or missing branches.

DO $$
DECLARE
  v_bad INT;
  v_a UUID; v_b UUID; v_c UUID;
BEGIN
  SELECT COUNT(*) INTO v_bad FROM temporary_patients WHERE branch_id NOT IN ('A','B','C');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ABORT: unmappable branch_id values present (%)', v_bad;
  END IF;

  SELECT id INTO v_a FROM branches WHERE name = 'Cabang A' LIMIT 1;
  SELECT id INTO v_b FROM branches WHERE name = 'Cabang B' LIMIT 1;
  SELECT id INTO v_c FROM branches WHERE name = 'Cabang C' LIMIT 1;
  IF v_a IS NULL OR v_b IS NULL OR v_c IS NULL THEN
    RAISE EXCEPTION 'ABORT: branch mapping incomplete (need Cabang A/B/C)';
  END IF;

  RAISE NOTICE 'Mapping: A->%, B->%, C->%', v_a, v_b, v_c;
END $$;

-- Step 1: Add temp UUID column
ALTER TABLE temporary_patients ADD COLUMN branch_id_uuid UUID;

-- Step 2: Map legacy chars to real UUIDs
UPDATE temporary_patients t
SET branch_id_uuid = b.id
FROM branches b
WHERE b.name = CASE t.branch_id
  WHEN 'A' THEN 'Cabang A'
  WHEN 'B' THEN 'Cabang B'
  WHEN 'C' THEN 'Cabang C'
END;

-- Step 3: Verify every row got a valid UUID (safety gate)
DO $$
DECLARE
  v_null INT;
BEGIN
  SELECT COUNT(*) INTO v_null FROM temporary_patients WHERE branch_id_uuid IS NULL;
  IF v_null > 0 THEN
    RAISE EXCEPTION 'ABORT: % rows failed mapping', v_null;
  END IF;
END $$;

-- Step 4: Drop legacy CHECK constraint
ALTER TABLE temporary_patients
  DROP CONSTRAINT IF EXISTS temporary_patients_branch_id_check;

-- Step 5: Drop old varchar column, rename new one
ALTER TABLE temporary_patients DROP COLUMN branch_id;
ALTER TABLE temporary_patients RENAME COLUMN branch_id_uuid TO branch_id;

-- Step 6: NOT NULL + index (parity before drop/rename)
ALTER TABLE temporary_patients ALTER COLUMN branch_id SET NOT NULL;

-- Step 7: Drop legacy index, recreate, add FK
DROP INDEX IF EXISTS idx_temp_patients_branch;
CREATE INDEX idx_temp_patients_branch ON temporary_patients(branch_id);

ALTER TABLE temporary_patients
  DROP CONSTRAINT IF EXISTS fk_temp_patients_branch;
ALTER TABLE temporary_patients
  ADD CONSTRAINT fk_temp_patients_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'Migration 034 applied: temporary_patients.branch_id now UUID + FK';
END $$;
