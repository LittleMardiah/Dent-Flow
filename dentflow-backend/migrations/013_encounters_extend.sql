-- ============================================
-- MIGRATION 013: Extend Encounters Table - FINAL
-- ============================================

-- 1. Tambahkan kolom baru
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS complaint TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS diagnosis TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS icd10_code VARCHAR(20);
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS treatment TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS prescription TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- 2. Hapus SEMUA check constraints di tabel encounters
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'encounters'::regclass 
          AND contype = 'c'
    ) LOOP
        EXECUTE 'ALTER TABLE encounters DROP CONSTRAINT IF EXISTS ' || constraint_name;
    END LOOP;
END $$;

-- 3. Update semua status yang tidak valid menjadi 'ONGOING'
UPDATE encounters SET status = 'ONGOING' 
WHERE status NOT IN ('ONGOING', 'COMPLETED', 'CANCELLED') 
   OR status IS NULL;

-- 4. Tambahkan constraint baru
ALTER TABLE encounters ADD CONSTRAINT encounters_status_check 
    CHECK (status IN ('ONGOING', 'COMPLETED', 'CANCELLED'));

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_encounters_patient_id ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_doctor_id ON encounters(doctor_id);
CREATE INDEX IF NOT EXISTS idx_encounters_branch_id ON encounters(branch_id);
CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters(status);
CREATE INDEX IF NOT EXISTS idx_encounters_started_at ON encounters(started_at);
CREATE INDEX IF NOT EXISTS idx_encounters_booking_id ON encounters(booking_id);
