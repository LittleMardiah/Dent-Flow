-- ============================================================
-- MIGRATION 012: Payment Reconciliation Support
-- Menambahkan kolom untuk reconciliation tracking
-- ============================================================

-- Tambahkan kolom ke payment_webhooks untuk reconciliation
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhooks' AND column_name = 'invoice_id'
    ) THEN
        ALTER TABLE payment_webhooks ADD COLUMN invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhooks' AND column_name = 'reconciliation_status'
    ) THEN
        ALTER TABLE payment_webhooks ADD COLUMN reconciliation_status VARCHAR(20) DEFAULT 'PENDING' 
        CHECK (reconciliation_status IN ('PENDING', 'MATCHED', 'UNMATCHED', 'MANUAL_REVIEW'));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhooks' AND column_name = 'gross_amount'
    ) THEN
        ALTER TABLE payment_webhooks ADD COLUMN gross_amount DECIMAL(12,2);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhooks' AND column_name = 'payment_type'
    ) THEN
        ALTER TABLE payment_webhooks ADD COLUMN payment_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhooks' AND column_name = 'transaction_status'
    ) THEN
        ALTER TABLE payment_webhooks ADD COLUMN transaction_status VARCHAR(50);
    END IF;
END $$;

-- Index untuk reconciliation
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_reconciliation_status ON payment_webhooks(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_invoice_id ON payment_webhooks(invoice_id);
