-- ============================================================
-- MIGRATION 009: Payment Webhooks (Idempotent)
-- ============================================================

-- 1. Table payment_webhooks (hanya dibuat jika belum ada)
CREATE TABLE IF NOT EXISTS payment_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id VARCHAR(255) NOT NULL UNIQUE,
    signature VARCHAR(255),
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'PERMANENTLY_FAILED')),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tambahkan kolom order_id jika belum ada (KRISIS!)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhooks' AND column_name = 'order_id'
    ) THEN
        ALTER TABLE payment_webhooks ADD COLUMN order_id VARCHAR(255) NOT NULL DEFAULT '';
    END IF;
END $$;

-- 3. Tambahkan kolom lain jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhooks' AND column_name = 'signature'
    ) THEN
        ALTER TABLE payment_webhooks ADD COLUMN signature VARCHAR(255);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhooks' AND column_name = 'payload'
    ) THEN
        ALTER TABLE payment_webhooks ADD COLUMN payload JSONB;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhooks' AND column_name = 'processed_at'
    ) THEN
        ALTER TABLE payment_webhooks ADD COLUMN processed_at TIMESTAMP;
    END IF;
END $$;

-- 4. Indexes (dengan IF NOT EXISTS, tapi HANYA jika kolom ada)
-- Tapi karena kita sudah tambahkan order_id di atas, aman
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_order_id ON payment_webhooks(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_status_processed ON payment_webhooks(status, processed_at);

-- 5. Table payment_webhook_errors
CREATE TABLE IF NOT EXISTS payment_webhook_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id VARCHAR(255) NOT NULL REFERENCES payment_webhooks(webhook_id) ON DELETE CASCADE,
    retry_count INT DEFAULT 0,
    last_error TEXT,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_errors_webhook_id ON payment_webhook_errors(webhook_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_errors_next_retry ON payment_webhook_errors(next_retry_at);
