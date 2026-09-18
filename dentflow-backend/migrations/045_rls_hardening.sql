-- Migration 045: RLS Hardening — 23 tables + 2 sequences + 13 RPC
-- Refs: TD-2.4.36 (RLS off 22+ tables), TD-2.4.41 (runner not atomic)
--   lesson 044 (inventory RLS ON precedent).
-- Backup baseline: /tmp/opencode/rls_before.txt
-- Rollback: see comment block 4 (reversal SQL idempotent).
--
-- Wrapped BEGIN/COMMIT untuk atomicity (migration runner tidak wrap).
-- Idempotent: ENABLE RLS rerun-safe; REVOKE/GRANT idempotent.

BEGIN;

-- (1) RLS ON + grant hardening — 23 tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patients','doctors','users','bookings','queues','encounters',
    'invoices','invoice_payments','invoice_sequences','payments',
    'payment_webhooks','payment_webhook_errors','audit_logs','branches',
    'doctor_schedules','doctor_leaves','notifications','temporary_patients',
    'user_branch_access','reset_tokens','migrations','queue_sequences',
    'service_pricing'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, public', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated, service_role', t);
  END LOOP;
END $$;

-- (2) Sequence hardening
REVOKE ALL ON SEQUENCE invoice_sequences_id_seq FROM anon, public;
GRANT USAGE, SELECT ON SEQUENCE invoice_sequences_id_seq TO authenticated, service_role;
REVOKE ALL ON SEQUENCE migrations_id_seq FROM anon, public;
GRANT USAGE ON SEQUENCE migrations_id_seq TO authenticated, service_role;

-- (3) RPC hardening — 13 fungsi (lesson 042/043)
REVOKE EXECUTE ON FUNCTION public.call_next_patient(uuid, uuid) FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.call_next_patient(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.convert_walk_in_temp_to_patient(uuid, text, text) FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.convert_walk_in_temp_to_patient(uuid, text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.doctor_checkin_patient(uuid, uuid) FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.doctor_checkin_patient(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_next_queue_number(uuid, uuid, date) FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.get_next_queue_number(uuid, uuid, date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_current_queue_number(uuid, uuid, date) FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.get_current_queue_number(uuid, uuid, date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.merge_patients(uuid, uuid[], uuid, uuid) FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.merge_patients(uuid, uuid[], uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_next_invoice_number(uuid, date) FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.get_next_invoice_number(uuid, date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_on_encounter_complete() FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.generate_invoice_on_encounter_complete() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.log_invoice_payment() FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.log_invoice_payment() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_delete() FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.prevent_audit_log_delete() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_update() FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.prevent_audit_log_update() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.prevent_invoice_payments_update() FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.prevent_invoice_payments_update() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.prevent_invoice_status_reversal() FROM anon, public;
GRANT    EXECUTE ON FUNCTION public.prevent_invoice_status_reversal() TO authenticated, service_role;

-- (4) Rollback comments (reversal SQL — tidak di-apply):
-- DO $$ DECLARE t TEXT; BEGIN
--   FOREACH t IN ARRAY ARRAY[
--     'patients','doctors','users','bookings','queues','encounters',
--     'invoices','invoice_payments','invoice_sequences','payments',
--     'payment_webhooks','payment_webhook_errors','audit_logs','branches',
--     'doctor_schedules','doctor_leaves','notifications','temporary_patients',
--     'user_branch_access','reset_tokens','migrations','queue_sequences',
--     'service_pricing'
--   ] LOOP
--     EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
--     EXECUTE format('GRANT ALL ON TABLE %I TO anon, public', t);
--   END LOOP;
-- END $$;
-- GRANT ALL ON SEQUENCE invoice_sequences_id_seq, migrations_id_seq TO anon, public;
-- GRANT EXECUTE ON FUNCTION public.call_next_patient(uuid, uuid),
--   public.convert_walk_in_temp_to_patient(uuid, text, text),
--   public.doctor_checkin_patient(uuid, uuid),
--   public.get_next_queue_number(uuid, uuid, date),
--   public.get_current_queue_number(uuid, uuid, date),
--   public.merge_patients(uuid, uuid[], uuid, uuid),
--   public.get_next_invoice_number(uuid, date),
--   public.generate_invoice_on_encounter_complete(),
--   public.log_invoice_payment(),
--   public.prevent_audit_log_delete(),
--   public.prevent_audit_log_update(),
--   public.prevent_invoice_payments_update(),
--   public.prevent_invoice_status_reversal()
-- TO anon, public;

DO $$ BEGIN RAISE NOTICE 'Migration 045 applied: RLS 23 tables + 2 seq + 13 RPC hardened'; END $$;

COMMIT;