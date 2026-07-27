-- ============================================
-- MIGRATION 014: Walk-in Temporary Profiles
-- ============================================

CREATE TABLE IF NOT EXISTS temporary_patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(1) NOT NULL CHECK (branch_id IN ('A', 'B', 'C')),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    age INTEGER,
    converted_to_patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_temp_patients_phone ON temporary_patients(phone);
CREATE INDEX IF NOT EXISTS idx_temp_patients_branch ON temporary_patients(branch_id);
CREATE INDEX IF NOT EXISTS idx_temp_patients_converted ON temporary_patients(converted_to_patient_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS temp_patient_id UUID REFERENCES temporary_patients(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN DEFAULT FALSE;
