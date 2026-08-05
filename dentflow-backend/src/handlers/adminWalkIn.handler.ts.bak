import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { pool } from '../config/database';

export const adminWalkInCheckin = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { name, phone, pasien_name, pasien_phone, doctor_id, branch_id } = req.body;
    const finalName = pasien_name || name;
    const finalPhone = pasien_phone || phone;

    if (!finalName || !finalPhone || !doctor_id || !branch_id) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    await client.query('BEGIN');

    // 1. Buat temporary patient
    const tempResult = await client.query(
      `INSERT INTO temporary_patients (branch_id, full_name, phone)
       VALUES ($1, $2, $3)
       RETURNING id, full_name`,
      [branch_id, finalName, finalPhone]
    );
    const tempPatient = tempResult.rows[0];

    // 2. Cek doctor record ID
    const doctorRecord = await client.query(
      `SELECT id FROM doctors WHERE user_id = $1 AND branch_id = $2 AND is_available = true`,
      [doctor_id, branch_id]
    );
    if (doctorRecord.rows.length === 0) {
      throw new Error('Doctor not found or not available');
    }
    const doctorRecordId = doctorRecord.rows[0].id;

    // 3. Buat booking (walk-in)
    const bookingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const bookingResult = await client.query(
      `INSERT INTO bookings 
        (temp_patient_id, doctor_id, branch_id, status, 
         booking_date, booking_time, session_start, session_end, booking_code)
       VALUES ($1, $2, $3, 'PAYMENT_CONFIRMED', 
               CURRENT_DATE, '09:00:00'::time, 
               (CURRENT_DATE + time '09:00:00')::timestamp, 
               (CURRENT_DATE + time '10:00:00')::timestamp, 
               $4)
       RETURNING id`,
      [tempPatient.id, doctorRecordId, branch_id, bookingCode]
    );
    const bookingId = bookingResult.rows[0].id;

    const queueNumber = Math.floor(Math.random() * 100) + 1;

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        queue_number: queueNumber,
        temp_patient_id: tempPatient.id,
        booking_id: bookingId,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error({ error: error.message }, 'Admin walk-in error');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};
