-- ============================================================
-- MIGRATION 011: Payment Webhooks - Make branch_id Nullable
-- ============================================================
BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_webhooks' AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE payment_webhooks ALTER COLUMN branch_id DROP NOT NULL;
        RAISE NOTICE 'ℹ️ [011] payment_webhooks.branch_id changed to NULLABLE';
    ELSE
        RAISE NOTICE '⚠️ [011] payment_webhooks.branch_id does not exist, skipping';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_branch_id_nullable 
    ON payment_webhooks(branch_id) 
    WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN payment_webhooks.branch_id IS 
    'Branch ID associated with webhook. NULL if invoice not yet found at webhook receipt time.';

COMMIT;
