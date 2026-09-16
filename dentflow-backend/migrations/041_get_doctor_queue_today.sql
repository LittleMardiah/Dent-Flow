-- Migration 041: RPC get_doctor_queue_today (doctor queue board)
-- Task 2.4 FASE B1 — mirror EXACT query Express pre-audit
-- (src/handlers/doctorQueue.handler.ts getDoctorQueueToday)

CREATE OR REPLACE FUNCTION get_doctor_queue_today(
  p_doctor_id UUID,
  p_branch_id UUID
)
RETURNS TABLE (
  id UUID,
  booking_id UUID,
  queue_number INTEGER,
  patient_id UUID,
  patient_name TEXT,
  check_in_time TIMESTAMP,
  status TEXT,
  is_walk_in BOOLEAN,
  wait_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.booking_id, q.queue_number,
         COALESCE(b.patient_id, b.temp_patient_id) AS patient_id,
         COALESCE(p.full_name, tp.full_name)::TEXT AS patient_name,
         q.created_at AS check_in_time,
         q.status::TEXT,
         COALESCE(b.is_walk_in, false) AS is_walk_in,
         ROUND(EXTRACT(EPOCH FROM (NOW() - q.created_at)) / 60)::int AS wait_minutes
  FROM queues q
  JOIN bookings b ON q.booking_id = b.id
  LEFT JOIN patients p ON b.patient_id = p.id
  LEFT JOIN temporary_patients tp ON b.temp_patient_id = tp.id
  WHERE q.doctor_id = p_doctor_id
    AND q.branch_id = p_branch_id
    AND q.deleted_at IS NULL
    AND DATE(q.created_at) = CURRENT_DATE
    AND q.status IN ('WAITING', 'BEING_CALLED', 'IN_SERVICE')
  ORDER BY q.queue_number ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_doctor_queue_today(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_doctor_queue_today(UUID, UUID) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'Migration 041 applied: get_doctor_queue_today RPC created';
END $$;