-- ============================================================
-- MIGRATION 018: Add payment_method column to invoices table
-- ============================================================

-- Tambahkan kolom payment_method
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);

-- Tambahkan constraint validasi (hanya CASH/TRANSFER/GATEWAY/NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'invoices_payment_method_check'
    ) THEN
        ALTER TABLE invoices 
        ADD CONSTRAINT invoices_payment_method_check 
        CHECK (payment_method IN ('CASH', 'TRANSFER', 'GATEWAY', NULL));
    END IF;
END $$;

-- Tambahkan index untuk performa
CREATE INDEX IF NOT EXISTS idx_invoices_payment_method 
ON invoices(payment_method);
