-- ============================================================
-- MIGRATION 030: Audit Trail Immutability
-- Mencegah UPDATE/DELETE pada tabel audit_logs.
-- Hanya INSERT yang diperbolehkan (append-only, immutable).
--
-- Satu-satunya pengecualian: FK `fk_audit_user ... ON DELETE SET NULL`
-- melakukan UPDATE internal user_id -> NULL saat user dihapus.
-- Pengecualian tsb TIDAK mengubah isi audit record, jadi diizinkan.
-- UPDATE lain (modifikasi konten) tetap DITOLAK.
-- ============================================================

-- 1. Function: tolak UPDATE pada audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Izinkan HANYA jika ini update internal RI (FK ON DELETE SET NULL)
    -- yang hanya meng-null-kan user_id (bukan modifikasi isi audit).
    IF pg_trigger_depth() > 0
       AND NEW.user_id IS NULL
       AND OLD.user_id IS NOT NULL
       AND NEW.branch_id   IS NOT DISTINCT FROM OLD.branch_id
       AND NEW.event_type  IS NOT DISTINCT FROM OLD.event_type
       AND NEW.entity_type IS NOT DISTINCT FROM OLD.entity_type
       AND NEW.entity_id   IS NOT DISTINCT FROM OLD.entity_id
       AND NEW.action      IS NOT DISTINCT FROM OLD.action
       AND NEW.old_values  IS NOT DISTINCT FROM OLD.old_values
       AND NEW.new_values  IS NOT DISTINCT FROM OLD.new_values
       AND NEW.description IS NOT DISTINCT FROM OLD.description
       AND NEW.ip_address  IS NOT DISTINCT FROM OLD.ip_address
       AND NEW.created_at  IS NOT DISTINCT FROM OLD.created_at
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE: UPDATE on audit_logs is not allowed (append-only)';
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger: tolak UPDATE pada audit_logs
DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_update();

-- 3. Function: tolak DELETE pada audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE: DELETE on audit_logs is not allowed (append-only)';
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger: tolak DELETE pada audit_logs
DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_delete();