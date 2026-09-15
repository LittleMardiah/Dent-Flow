-- Migration 039: RPC doctor_checkin_patient (atomic queue complete + encounter start)
-- Task 2.4.8c — D4
-- Design dari pre-audit 2.4.8c:
-- - Resolve doctors.id INTERNAL dari users.id (L2 fix).
-- - Guard status WAITING + BEING_CALLED (flow normal: call_next -> check-in).
-- - Guard patient_id NULL -> BOOKING_WALKIN_NOT_CONVERTED (parity E1).
-- - Encounter status='ONGOING' eksplisit.
-- - Audit QUEUE_COMPLETED + ENCOUNTER_STARTED dalam 1 tx.

CREATE OR REPLACE FUNCTION doctor_checkin_patient(
  p_queue_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue RECORD;
  v_booking RECORD;
  v_doctor_id UUID;
  v_encounter_id UUID;
  v_now TIMESTAMP := NOW();
BEGIN
  -- Resolve doctors.id dari users.id (L2 fix)
  SELECT id INTO v_doctor_id FROM doctors WHERE user_id = p_user_id;
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'DOCTOR_NOT_FOUND';
  END IF;

  -- Lock queue
  SELECT * INTO v_queue FROM queues WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND';
  END IF;

  -- Guard status: WAITING + BEING_CALLED
  IF v_queue.status NOT IN ('WAITING', 'BEING_CALLED') THEN
    RAISE EXCEPTION 'QUEUE_NOT_WAITING';
  END IF;

  -- Guard doctor ownership (parity Express WHERE doctor_id = $2)
  IF v_queue.doctor_id != v_doctor_id THEN
    RAISE EXCEPTION 'QUEUE_NOT_FOUND';
  END IF;

  -- Get booking
  SELECT * INTO v_booking FROM bookings WHERE id = v_queue.booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  -- Guard patient_id NULL (walk-in belum convert)
  IF v_booking.patient_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_WALKIN_NOT_CONVERTED';
  END IF;

  -- Update queue
  UPDATE queues SET status='COMPLETED', completed_at=v_now WHERE id=p_queue_id;

  -- Insert encounter (status ONGOING eksplisit)
  INSERT INTO encounters (
    branch_id, booking_id, doctor_id, patient_id, status, started_at
  ) VALUES (
    v_booking.branch_id, v_booking.id, v_booking.doctor_id, v_booking.patient_id,
    'ONGOING', v_now
  ) RETURNING id INTO v_encounter_id;

  -- Audit QUEUE_COMPLETED
  INSERT INTO audit_logs (branch_id, user_id, event_type, entity_type, entity_id,
    new_values, description, created_at)
  VALUES (v_booking.branch_id, p_user_id, 'QUEUE_COMPLETED', 'QUEUE', p_queue_id,
    jsonb_build_object('status', 'COMPLETED', 'queue_number', v_queue.queue_number),
    'Queue ' || v_queue.queue_number || ' completed', v_now);

  -- Audit ENCOUNTER_STARTED
  INSERT INTO audit_logs (branch_id, user_id, event_type, entity_type, entity_id,
    new_values, description, created_at)
  VALUES (v_booking.branch_id, p_user_id, 'ENCOUNTER_STARTED', 'ENCOUNTER', v_encounter_id,
    jsonb_build_object('booking_id', v_booking.id, 'status', 'ONGOING'),
    'Encounter started for booking ' || v_booking.id, v_now);

  -- Return JSON
  RETURN jsonb_build_object(
    'queue', jsonb_build_object(
      'id', v_queue.id,
      'queue_number', v_queue.queue_number,
      'booking_id', v_queue.booking_id,
      'doctor_id', v_queue.doctor_id,
      'branch_id', v_queue.branch_id,
      'status', 'COMPLETED',
      'completed_at', v_now
    ),
    'encounter', jsonb_build_object(
      'id', v_encounter_id,
      'booking_id', v_booking.id,
      'doctor_id', v_booking.doctor_id,
      'patient_id', v_booking.patient_id,
      'branch_id', v_booking.branch_id,
      'status', 'ONGOING',
      'started_at', v_now
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION doctor_checkin_patient(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION doctor_checkin_patient(UUID, UUID) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'Migration 039 applied: doctor_checkin_patient RPC created';
END $$;