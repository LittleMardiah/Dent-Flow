-- Migration 042: Revoke anon/public EXECUTE on get_doctor_queue_today
-- Supabase default: functions default to public EXECUTE unless revoked.
-- Restrict to authenticated + service_role (idempotent).

REVOKE EXECUTE ON FUNCTION get_doctor_queue_today(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION get_doctor_queue_today(UUID, UUID) TO authenticated, service_role;

DO $$ BEGIN
  RAISE NOTICE 'Migration 042 applied: anon/public revoked, authenticated + service_role granted';
END $$;