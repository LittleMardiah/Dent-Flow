-- ============================================================
-- MIGRATION 015: NO-SHOW Detection (Safe)
-- ============================================================

-- 1. Tambahkan kolom no_show_at
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMP;

-- 2. Hapus constraint status lama (jika ada)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- 3. Update status yang tidak valid ke yang sesuai
-- 'PENDING' -> 'PENDING_PAYMENT' (lama)
UPDATE bookings SET status = 'PENDING_PAYMENT' WHERE status = 'PENDING';

-- 4. Tambahkan constraint baru dengan NOT VALID
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
    CHECK (status IN ('PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW', 'CANCELLED')) NOT VALID;

-- 5. Validasi constraint
ALTER TABLE bookings VALIDATE CONSTRAINT bookings_status_check;
