-- ============================================
-- Migration 036: Fix trigger function v_invoice_number VARCHAR(50) -> 255
-- Task 2.4.6-FIX
-- ============================================
-- Root cause: function generate_invoice_on_encounter_complete declare
-- v_invoice_number VARCHAR(50). get_next_invoice_number return 53 chars
-- (INV-{uuid36}-{yyyymmdd}-{seq}). Overflow -> exception -> rollback.
-- Fix: CREATE OR REPLACE FUNCTION dengan VARCHAR(255).
-- Trigger TIDAK di-drop (function body saja yang di-replace).

CREATE OR REPLACE FUNCTION generate_invoice_on_encounter_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_number VARCHAR(255);
  v_branch_id UUID;
  v_patient_id UUID;
  v_booking_id UUID;
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    SELECT branch_id, patient_id, id AS booking_id
    INTO v_branch_id, v_patient_id, v_booking_id
    FROM bookings WHERE id = NEW.booking_id;

    v_invoice_number := get_next_invoice_number(v_branch_id, CURRENT_DATE);

    INSERT INTO invoices (
      id, branch_id, encounter_id, patient_id, booking_id,
      invoice_number, amount_due, status, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_branch_id, NEW.id, v_patient_id, v_booking_id,
      v_invoice_number, 0, 'UNPAID', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (encounter_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  RAISE NOTICE 'Migration 036 applied: v_invoice_number VARCHAR(255)';
END $$;