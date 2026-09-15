-- ============================================
-- Migration 037: RPC merge_patients (atomic multi-table)
-- Task 2.4.8a
-- ============================================
-- Express patient.handler.mergePatients = BEGIN/COMMIT 1-koneksi.
-- Serverless Supabase JS tidak bisa atomic multi-write -> PL/pgSQL RPC.
--
-- Flow:
-- 1. Validate primary + dups exists (same branch, not deleted)
-- 2. UPDATE bookings SET patient_id = primary WHERE patient_id = dup
-- 3. UPDATE encounters SET patient_id = primary WHERE patient_id = dup
-- 4. UPDATE invoices SET patient_id = primary WHERE patient_id = dup
-- 5. UPDATE patients SET deleted_at = NOW() WHERE id = dup (soft delete)
-- 6. UPDATE users SET is_active = false WHERE id = dup.user_id (improvement)
-- 7. INSERT audit_logs PATIENT_MERGED (improvement, Express gap)
-- Return: mergedCount.

CREATE OR REPLACE FUNCTION merge_patients(
  p_primary_id UUID,
  p_dup_ids UUID[],
  p_branch_id UUID,
  p_user_id UUID
)
RETURNS TABLE (primary_id UUID, merged_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_primary patients%ROWTYPE;
  v_dup patients%ROWTYPE;
  v_dup_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Validate primary
  SELECT * INTO v_primary FROM patients
    WHERE id = p_primary_id AND branch_id = p_branch_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRIMARY_PATIENT_NOT_FOUND';
  END IF;

  -- Validate duplicates not empty
  IF p_dup_ids IS NULL OR array_length(p_dup_ids, 1) IS NULL OR array_length(p_dup_ids, 1) = 0 THEN
    RAISE EXCEPTION 'NO_DUPLICATE_IDS';
  END IF;

  -- Loop dups
  FOREACH v_dup_id IN ARRAY p_dup_ids LOOP
    -- Skip primary from dups
    IF v_dup_id = p_primary_id THEN CONTINUE; END IF;

    SELECT * INTO v_dup FROM patients
      WHERE id = v_dup_id AND branch_id = p_branch_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'DUPLICATE_PATIENT_NOT_FOUND';
    END IF;

    -- UPDATE FK references to primary
    UPDATE bookings SET patient_id = p_primary_id, updated_at = NOW() WHERE patient_id = v_dup_id;
    UPDATE encounters SET patient_id = p_primary_id, updated_at = NOW() WHERE patient_id = v_dup_id;
    UPDATE invoices SET patient_id = p_primary_id, updated_at = NOW() WHERE patient_id = v_dup_id;

    -- Soft-delete dup
    UPDATE patients SET deleted_at = NOW(), updated_at = NOW() WHERE id = v_dup_id;

    -- Nonaktifkan user dup (improvement parity P2)
    UPDATE users SET is_active = false WHERE id = v_dup.user_id;

    -- Audit per dup
    INSERT INTO audit_logs (branch_id, user_id, event_type, entity_type, entity_id, new_values, description, created_at)
    VALUES (p_branch_id, p_user_id, 'PATIENT_MERGED', 'PATIENT', p_primary_id,
            jsonb_build_object('dup_patient_id', v_dup_id, 'dup_user_id', v_dup.user_id),
            'Pasien ' || v_dup_id || ' digabung ke ' || p_primary_id, NOW());

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT p_primary_id, v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION merge_patients(UUID, UUID[], UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION merge_patients(UUID, UUID[], UUID, UUID) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'Migration 037 applied: merge_patients RPC created';
END $$;
