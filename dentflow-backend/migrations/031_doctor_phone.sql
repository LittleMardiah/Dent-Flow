-- ============================================
-- MIGRATION 031: Add phone column to users
-- Dibutuhkan oleh GET/PUT /api/doctors/me (profil dokter)
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);