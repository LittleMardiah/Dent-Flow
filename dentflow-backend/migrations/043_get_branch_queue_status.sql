-- Migration 043: RPC get_branch_queue_status (branch queue board / TV display)
-- Task 2.6 FASE B1 — mirror EXACT query Express pre-audit
-- (src/services/queueManagement.service.ts getTvDisplay)

CREATE OR REPLACE FUNCTION get_branch_queue_status(
  p_branch_id UUID,
  p_doctor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  queue_number INTEGER,
  status TEXT,
  check_in_time TIMESTAMP,
  patient_id UUID,
  patient_name TEXT,
  is_walk_in BOOLEAN,
  wait_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.queue_number, q.status::TEXT,
         q.created_at AS check_in_time,
         COALESCE(b.patient_id, b.temp_patient_id) AS patient_id,
         COALESCE(p.full_name, tp.full_name, u.username)::TEXT AS patient_name,
         COALESCE(b.is_walk_in, false) AS is_walk_in,
         ROUND(EXTRACT(EPOCH FROM (NOW() - q.created_at)) / 60)::int AS wait_minutes
  FROM queues q
  JOIN bookings b ON q.booking_id = b.id
  LEFT JOIN patients p ON b.patient_id = p.id
  LEFT JOIN temporary_patients tp ON b.temp_patient_id = tp.id
  LEFT JOIN users u ON p.user_id = u.id
  WHERE q.branch_id = p_branch_id
    AND q.deleted_at IS NULL
    AND DATE(q.created_at) = CURRENT_DATE
    AND (p_doctor_id IS NULL OR q.doctor_id = p_doctor_id)
  ORDER BY q.queue_number ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_branch_queue_status(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION get_branch_queue_status(UUID, UUID) TO authenticated, service_role;

DO $$ BEGIN
  RAISE NOTICE 'Migration 043 applied: get_branch_queue_status RPC created (anon/public revoked)';
END $$;