-- ============================================================
-- MIGRATION 002: Booking System & Reset Tokens
-- Gabungan dari: add_booking_columns + booking_system + reset_tokens
-- ============================================================

-- ========================================
-- PART 1: Reset Tokens
-- ========================================
CREATE TABLE IF NOT EXISTS reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON reset_tokens(user_id);

-- ========================================
-- PART 2: Booking Columns & Indexes
-- ========================================
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS session_start TIMESTAMP,
ADD COLUMN IF NOT EXISTS session_end TIMESTAMP,
ADD COLUMN IF NOT EXISTS temp_profile_flag BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS queue_number INTEGER,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancelled_reason VARCHAR(255),
ADD COLUMN IF NOT EXISTS patient_notes TEXT,
ADD COLUMN IF NOT EXISTS check_in_code VARCHAR(10);

-- Index untuk pengecekan slot
CREATE INDEX IF NOT EXISTS idx_bookings_slot_check 
ON bookings(branch_id, doctor_id, session_start, session_end) 
WHERE status NOT IN ('CANCELLED', 'NO_SHOW');

CREATE INDEX IF NOT EXISTS idx_bookings_patient_id_status 
ON bookings(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_availability 
ON bookings(branch_id, doctor_id, booking_date, session_start) 
WHERE status NOT IN ('CANCELLED');

CREATE INDEX IF NOT EXISTS idx_bookings_patient_status 
ON bookings(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_branch_date 
ON bookings(branch_id, booking_date);

-- Unique constraint untuk mencegah double booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_active_slot 
ON bookings(branch_id, doctor_id, session_start, session_end) 
WHERE status NOT IN ('CANCELLED', 'NO_SHOW');

-- ========================================
-- PART 3: Pastikan check_in_code unique
-- ========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_check_in_code_key'
    ) THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_check_in_code_key UNIQUE (check_in_code);
    END IF;
END $$;

-- ========================================
-- PART 4: Update existing data (jika ada)
-- ========================================
UPDATE bookings 
SET session_start = (booking_date + booking_time), 
    session_end = (booking_date + booking_time + INTERVAL '3 hours')
WHERE session_start IS NULL AND booking_date IS NOT NULL;
