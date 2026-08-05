-- ====================================================================
-- MIGRATION 024: Fix invoice payment trigger (remove transaction_id)
-- ====================================================================
-- Trigger sebelumnya mencoba mengakses NEW.transaction_id, tapi kolom tsb
-- tidak ada di tabel invoices. Kita ganti dengan NULL.

CREATE OR REPLACE FUNCTION log_invoice_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO invoice_payments (
            invoice_id,
            status,
            payment_method,
            transaction_id,
            amount,
            paid_at
        ) VALUES (
            NEW.id,
            NEW.status,
            NEW.payment_method,
            NULL,  -- transaction_id tidak ada di invoices, pakai NULL
            NEW.paid_amount,
            NEW.paid_at
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
