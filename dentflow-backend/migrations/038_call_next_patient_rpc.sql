-- Migration 038: RPC call_next_patient (atomic queue call)
-- Task 2.4.8b — F4 FIX: NULL::uuid AS patient_id (queues no patient_id)

CREATE OR REPLACE FUNCTION call_next_patient(
  p_doctor_id UUID,
  p_branch_id UUID
)
RETURNS TABLE (
  queue_id UUID,
  queue_number INTEGER,
  booking_id UUID,
  patient_id UUID,
  doctor_id UUID,
  status VARCHAR(50),
  called_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue RECORD;
BEGIN
  SELECT q.id, q.queue_number, q.booking_id, q.branch_id, q.doctor_id, q.status
  INTO v_queue
  FROM queues q
  WHERE q.doctor_id = p_doctor_id
    AND q.branch_id = p_branch_id
    AND q.status = 'WAITING'
    AND q.deleted_at IS NULL
  ORDER BY q.queue_number ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE queues
  SET status = 'BEING_CALLED', called_at = NOW()
  WHERE id = v_queue.id;

  RETURN QUERY
  SELECT q.id AS queue_id, q.queue_number, q.booking_id,
         NULL::uuid AS patient_id,
         q.doctor_id, q.status, q.called_at
  FROM queues q
  WHERE q.id = v_queue.id;
END;
$$;

GRANT EXECUTE ON FUNCTION call_next_patient(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION call_next_patient(UUID, UUID) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'Migration 038 applied';
END $$;