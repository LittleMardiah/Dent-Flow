-- ============================================================
-- MIGRATION 010: Webhook Retry & Auto-Cancel
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhook_errors' AND column_name = 'retry_count'
    ) THEN
        ALTER TABLE payment_webhook_errors ADD COLUMN retry_count INT DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhook_errors' AND column_name = 'last_error'
    ) THEN
        ALTER TABLE payment_webhook_errors ADD COLUMN last_error TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhook_errors' AND column_name = 'next_retry_at'
    ) THEN
        ALTER TABLE payment_webhook_errors ADD COLUMN next_retry_at TIMESTAMP;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_webhook_errors_next_retry ON payment_webhook_errors(next_retry_at);
