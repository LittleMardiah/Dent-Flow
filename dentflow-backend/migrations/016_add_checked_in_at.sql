-- Migration: Add checked_in_at column to bookings
-- Untuk mendukung check-in tracking

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP;
