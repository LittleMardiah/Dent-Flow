-- ============================================================
-- MIGRATION 009: Add index for audit logs filtering
-- Mempercepat query berdasarkan entity_type dan entity_id
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_entity_id 
ON audit_logs(entity_type, entity_id);

-- Tambahkan index untuk created_at jika belum ada (untuk sorting)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON audit_logs(created_at DESC);
