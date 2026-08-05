-- ====================================================================
-- MIGRATION 025: Fix trigger for NULL paid_amount
-- ====================================================================
-- Saat status berubah ke UNPAID, paid_amount menjadi NULL, tapi kolom amount
-- di invoice_payments NOT NULL. Kita gunakan COALESCE untuk default 0.

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
            NULL,
            COALESCE(NEW.paid_amount, 0),
            NEW.paid_at
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
