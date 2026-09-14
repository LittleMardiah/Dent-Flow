-- ============================================
-- Migration 035: convert_walk_in_temp_to_patient (RPC)
-- Task 2.4.4a — multi-table atomic conversion
-- ============================================
-- Root cause untuk RPC: Supabase JS tidak bisa atomic multi-table tx.
-- Express pakai BEGIN/COMMIT (walkIn.service.ts L190-306).
-- Serverless pengganti = PL/pgSQL function atomic.
--
-- DECISION (2.4.4 pre-audit): Opsi 3 — hash di lambda, function terima
-- p_password_hash TEXT. Alasan: password plaintext TIDAK masuk Supabase logs.
--
-- Flow parity Express (9 steps atomic):
--   1. SELECT temp + FOR UPDATE (row lock)
--   2. Cek already converted
--   3. Cek email collision
--   4. Generate unique username (collision loop)
--   5. INSERT users
--   6. INSERT patients
--   7. UPDATE bookings SET patient_id (patients.id!), temp_patient_id=NULL
--   8. UPDATE temporary_patients SET converted_to_patient_id + updated_at
--   9. INSERT audit_logs WALK_IN_CONVERTED
-- Return: user_id, branch_id, role, email, patient_id (untuk sign JWT di lambda).
--
-- NOTE parity penting (hasil audit 2.4.4a STEP 1-3):
--   - bookings.patient_id FK -> patients(id) (migration 001 fk_bookings_patient).
--     Jadi SET patient_id = patients.id (bukan users.id). Express pakai
--     newPatientRecordId = patients.id (walkIn.service.ts L262-266).
--   - temporary_patients.updated_at ikut di-set (Express L271).
--   - username parity Express L223: lowercase + hapus [^a-z0-9_] (bukan ganti '_').
--   - branch_id temporary_patients sudah UUID sejak migration 034 -> aman.

CREATE OR REPLACE FUNCTION convert_walk_in_temp_to_patient(
  p_temp_id UUID,
  p_email TEXT,
  p_password_hash TEXT
)
RETURNS TABLE (
  user_id UUID,
  branch_id UUID,
  role VARCHAR(50),
  email VARCHAR(255),
  patient_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_temp temporary_patients%ROWTYPE;
  v_user_id UUID;
  v_patient_id UUID;
  v_username VARCHAR(100);
  v_base_username VARCHAR(100);
  v_counter INT := 0;
BEGIN
  -- STEP 1: SELECT + row lock (prevent double convert race)
  SELECT * INTO v_temp
  FROM temporary_patients
  WHERE id = p_temp_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEMP_PATIENT_NOT_FOUND';
  END IF;

  -- STEP 2: cek already converted
  IF v_temp.converted_to_patient_id IS NOT NULL THEN
    RAISE EXCEPTION 'TEMP_PATIENT_ALREADY_CONVERTED';
  END IF;

  -- STEP 3: cek email collision (parity Express L212-218, exact match)
  IF EXISTS (SELECT 1 FROM users WHERE users.email = p_email) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS';
  END IF;

  -- STEP 4: generate username (parity Express L223-238)
  v_base_username := LOWER(SPLIT_PART(p_email, '@', 1));
  v_base_username := REGEXP_REPLACE(v_base_username, '[^a-z0-9_]', '', 'g');
  IF v_base_username IS NULL OR v_base_username = '' THEN
    v_base_username := 'patient';
  END IF;
  v_username := v_base_username;

  WHILE EXISTS (SELECT 1 FROM users WHERE users.username = v_username) LOOP
    v_counter := v_counter + 1;
    v_username := v_base_username || v_counter::TEXT;
    IF v_counter > 1000 THEN
      RAISE EXCEPTION 'USERNAME_COLLISION_OVERFLOW';
    END IF;
  END LOOP;

  -- STEP 5: INSERT users
  INSERT INTO users (branch_id, role, email, username, password_hash, is_active)
  VALUES (v_temp.branch_id, 'PATIENT', p_email, v_username, p_password_hash, true)
  RETURNING id INTO v_user_id;

  -- STEP 6: INSERT patients
  INSERT INTO patients (branch_id, user_id, full_name, phone, walk_in_profile_id)
  VALUES (v_temp.branch_id, v_user_id, v_temp.full_name, v_temp.phone, p_temp_id)
  RETURNING id INTO v_patient_id;

  -- STEP 7: UPDATE bookings
  -- patient_id = patients.id (FK fk_bookings_patient). BUKAN users.id!
  UPDATE bookings
  SET patient_id = v_patient_id,
      temp_patient_id = NULL,
      updated_at = NOW()
  WHERE temp_patient_id = p_temp_id;

  -- STEP 8: UPDATE temporary_patients (mark converted)
  UPDATE temporary_patients
  SET converted_to_patient_id = v_user_id,
      updated_at = NOW()
  WHERE id = p_temp_id;

  -- STEP 9: INSERT audit_logs (parity Express WALK_IN_CONVERTED)
  INSERT INTO audit_logs (
    branch_id, user_id, event_type, entity_type, entity_id,
    old_values, new_values, description, created_at
  ) VALUES (
    v_temp.branch_id,
    v_user_id,
    'WALK_IN_CONVERTED',
    'USER',
    v_user_id,
    jsonb_build_object('tempPatientId', p_temp_id),
    jsonb_build_object('patientId', v_user_id, 'email', p_email),
    'Temporary profile converted to full patient account for ' || v_temp.full_name,
    NOW()
  );

  -- Return (lambda pakai ini untuk sign JWT)
  RETURN QUERY SELECT v_user_id, v_temp.branch_id, 'PATIENT'::VARCHAR(50), p_email::VARCHAR(255), v_patient_id;
END;
$$;

-- Grant execute ke service_role + authenticated (parity migration 032)
GRANT EXECUTE ON FUNCTION convert_walk_in_temp_to_patient(UUID, TEXT, TEXT)
  TO service_role, authenticated;

-- Verify log
DO $$
BEGIN
  RAISE NOTICE 'Migration 035 applied: convert_walk_in_temp_to_patient function created';
END $$;