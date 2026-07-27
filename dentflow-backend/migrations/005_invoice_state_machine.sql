-- ============================================================
-- MIGRATION 005: Invoice State Machine (Complete)
-- Gabungan dari: invoice_state_machine + invoice_constraint + safe
-- ============================================================

-- ========================================
-- PART 1: Kolom di invoices
-- ========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'payment_status') THEN
        ALTER TABLE invoices ADD COLUMN payment_status VARCHAR(20) DEFAULT 'UNPAID';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'paid_at') THEN
        ALTER TABLE invoices ADD COLUMN paid_at TIMESTAMP;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'paid_amount') THEN
        ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(12, 2);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'paid_by_admin_id') THEN
        ALTER TABLE invoices ADD COLUMN paid_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'payment_notes') THEN
        ALTER TABLE invoices ADD COLUMN payment_notes TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'previous_status') THEN
        ALTER TABLE invoices ADD COLUMN previous_status VARCHAR(20);
    END IF;
END $$;

-- ========================================
-- PART 2: Tabel invoice_payments
-- ========================================
CREATE TABLE IF NOT EXISTS invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('UNPAID', 'PAID')),
    payment_method VARCHAR(20) CHECK (payment_method IN ('CASH', 'TRANSFER', 'GATEWAY')),
    transaction_id VARCHAR(255),
    amount DECIMAL(12, 2) NOT NULL,
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invoice_id, status, paid_at)
);

-- ========================================
-- PART 3: Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_paid_at ON invoice_payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON invoices(paid_at);

-- ========================================
-- PART 4: Constraint valid_paid_state
-- ========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_paid_state') THEN
        EXECUTE 'ALTER TABLE invoices ADD CONSTRAINT valid_paid_state CHECK (
            (payment_status = ''UNPAID'' AND paid_at IS NULL AND paid_amount IS NULL)
            OR
            (payment_status = ''PAID'' AND paid_at IS NOT NULL AND paid_amount IS NOT NULL)
        )';
    END IF;
END $$;

-- ========================================
-- PART 5: Trigger: log invoice payment
-- ========================================
CREATE OR REPLACE FUNCTION log_invoice_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO invoice_payments (invoice_id, status, payment_method, transaction_id, amount, paid_at)
        VALUES (NEW.id, NEW.status, NEW.payment_method, NEW.transaction_id, NEW.paid_amount, NEW.paid_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_payment_log ON invoices;
CREATE TRIGGER trg_invoice_payment_log
AFTER UPDATE OF status ON invoices
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_invoice_payment();

-- ========================================
-- PART 6: Trigger: prevent status reversal
-- ========================================
CREATE OR REPLACE FUNCTION prevent_invoice_status_reversal()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.payment_status = 'PAID' AND NEW.payment_status = 'UNPAID' THEN
        RAISE EXCEPTION 'Cannot reverse invoice status from PAID to UNPAID';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_status_reversal_trigger ON invoices;
CREATE TRIGGER invoice_status_reversal_trigger
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION prevent_invoice_status_reversal();

-- ========================================
-- PART 7: Trigger: immutable invoice_payments
-- ========================================
CREATE OR REPLACE FUNCTION prevent_invoice_payments_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'invoice_payments is immutable (append-only)';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_payments_immutable ON invoice_payments;
CREATE TRIGGER trg_invoice_payments_immutable
BEFORE UPDATE ON invoice_payments
FOR EACH ROW
EXECUTE FUNCTION prevent_invoice_payments_update();
