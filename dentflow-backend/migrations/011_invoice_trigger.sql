-- ============================================================
-- MIGRATION 012: Invoice Generation Trigger on Encounter Complete
-- Otomatis buat invoice saat encounters.status berubah ke 'COMPLETED'
-- ============================================================

-- 1. Function untuk generate invoice
CREATE OR REPLACE FUNCTION generate_invoice_on_encounter_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_number VARCHAR(50);
    v_branch_id UUID;
    v_patient_id UUID;
    v_amount_due DECIMAL(12,2);
    v_booking_id UUID;
BEGIN
    -- Hanya proses jika status berubah ke 'COMPLETED'
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        -- Ambil data dari encounter
        SELECT branch_id, patient_id, booking_id 
        INTO v_branch_id, v_patient_id, v_booking_id
        FROM encounters WHERE id = NEW.id;
        
        -- Generate invoice number (gunakan function dari migration 004)
        v_invoice_number := get_next_invoice_number(v_branch_id, CURRENT_DATE);
        
        -- Hitung amount (default 0, nanti bisa diupdate dari treatment)
        -- Bisa juga ambil dari booking.dp_amount + treatment cost
        v_amount_due := 0; -- Akan di-set oleh service atau nanti diupdate
        
        -- Insert invoice (jika belum ada)
        INSERT INTO invoices (
            id, branch_id, encounter_id, patient_id, booking_id,
            invoice_number, invoice_date, amount_due, amount_paid, status
        ) VALUES (
            gen_random_uuid(), v_branch_id, NEW.id, v_patient_id, v_booking_id,
            v_invoice_number, CURRENT_DATE, v_amount_due, 0, 'UNPAID'
        ) ON CONFLICT (encounter_id) DO NOTHING;
        
        -- Catat audit log (akan dilakukan di application layer juga)
        -- Trigger ini hanya untuk backup consistency
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger pada encounters
DROP TRIGGER IF EXISTS trg_generate_invoice_on_encounter_complete ON encounters;
CREATE TRIGGER trg_generate_invoice_on_encounter_complete
AFTER UPDATE OF status ON encounters
FOR EACH ROW
EXECUTE FUNCTION generate_invoice_on_encounter_complete();
