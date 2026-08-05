-- ====================================================================
-- MIGRATION 022: Add dp_amount column to bookings (TD-PAY-016 (2))
-- ====================================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dp_amount DECIMAL(12,2) DEFAULT 50000;
