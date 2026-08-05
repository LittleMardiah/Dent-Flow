-- ====================================================================
-- MIGRATION 023: Add trigger to log invoice payment history
-- ====================================================================
-- Trigger ini otomatis mencatat history ke invoice_payments
-- setiap kali status invoice berubah (UNPAID → PAID)

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
            NEW.transaction_id,
            NEW.paid_amount,
            NEW.paid_at
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS trg_log_invoice_payment ON invoices;

-- Create trigger
CREATE TRIGGER trg_log_invoice_payment
AFTER UPDATE OF status ON invoices
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_invoice_payment();

-- Enable trigger (just in case)
ALTER TABLE invoices ENABLE TRIGGER trg_log_invoice_payment;
