-- ============================================================
-- MIGRATION 008: Extend doctor_schedules & add doctor_leaves
-- Untuk mendukung availability checking dan leave management
-- ============================================================

-- Tambah kolom slot_duration_minutes ke doctor_schedules (default 30)
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER DEFAULT 30;

-- Buat tabel doctor_leaves untuk mencatat leave/izin dokter
CREATE TABLE IF NOT EXISTS doctor_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (start_date <= end_date)
);

CREATE INDEX idx_doctor_leaves_doctor_id ON doctor_leaves(doctor_id);
CREATE INDEX idx_doctor_leaves_branch_id ON doctor_leaves(branch_id);
CREATE INDEX idx_doctor_leaves_dates ON doctor_leaves(start_date, end_date);
