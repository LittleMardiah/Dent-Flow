-- ============================================================
-- MIGRATION 003: doctor_schedules
-- Membuat tabel jadwal dokter sesuai PRD & TDD
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    dokter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    session_start TIME NOT NULL,
    session_end TIME NOT NULL,
    max_patients_per_session INTEGER DEFAULT 4,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctor_schedules_dokter_id ON doctor_schedules(dokter_id);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_branch_id ON doctor_schedules(branch_id);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_day ON doctor_schedules(day_of_week);
