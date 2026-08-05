import { Request, Response } from 'express';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

const pool = new Pool({ connectionString: config.database.url });

export const adminWalkInCheckin = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { name, phone, doctor_id, branch_id } = req.body;
    const adminId = req.user?.userId;

    if (!name || !doctor_id || !branch_id) {
      return res.status(400).json({
        success: false,
        message: 'name, doctor_id, dan branch_id wajib diisi',
      });
    }

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin tidak terautentikasi',
      });
    }

    // 1. Insert temporary patient
    const tempResult = await client.query(
      `INSERT INTO temporary_patients (name, phone, branch_id) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      [name, phone, branch_id]
    );
    const tempPatientId = tempResult.rows[0].id;

    // 2. Get existing patient record (seed)
    const patientRes = await client.query(
      `SELECT id FROM patients WHERE user_id = $1 LIMIT 1`,
      ['d83659a9-6657-4c3e-a488-923e3d3d52c0']
    );
    if (patientRes.rows.length === 0) {
      throw new Error('PATIENT_NOT_FOUND');
    }
    const patientId = patientRes.rows[0].id;

    // 3. Get doctor record
    const doctorRes = await client.query(
      `SELECT id FROM doctors WHERE user_id = $1 LIMIT 1`,
      [doctor_id]
    );
    if (doctorRes.rows.length === 0) {
      throw new Error('DOCTOR_NOT_FOUND');
    }
    const realDoctorId = doctorRes.rows[0].id;

    // 4. Create booking
    const today = new Date();
    const bookingDate = today.toISOString().split('T')[0];
    const sessionStart = `${bookingDate} 09:00:00`;
    const sessionEnd = `${bookingDate} 12:00:00`;
    const bookingTime = '09:00:00';
    const bookingCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const bookingResult = await client.query(
      `INSERT INTO bookings 
       (branch_id, patient_id, doctor_id, status, booking_date, booking_time, 
        session_start, session_end, booking_code, temp_patient_id) 
       VALUES ($1, $2, $3, 'PAYMENT_CONFIRMED', $4, $5, $6, $7, $8, $9) 
       RETURNING id`,
      [branch_id, patientId, realDoctorId, bookingDate, bookingTime, 
       sessionStart, sessionEnd, bookingCode, tempPatientId]
    );
    const bookingId = bookingResult.rows[0].id;

    // 5. Generate queue number
    const queueCount = await client.query(
      `SELECT COUNT(*) as count FROM queues 
       WHERE doctor_id = $1 AND branch_id = $2 AND DATE(created_at) = CURRENT_DATE`,
      [realDoctorId, branch_id]
    );
    const queueNumber = parseInt(queueCount.rows[0].count) + 1;

    // 6. Insert queue
    await client.query(
      `INSERT INTO queues (booking_id, doctor_id, branch_id, queue_number, status) 
       VALUES ($1, $2, $3, $4, 'WAITING')`,
      [bookingId, realDoctorId, branch_id, queueNumber]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        queue_number: queueNumber,
        temp_patient_id: tempPatientId,
        booking_id: bookingId,
      },
      message: 'Walk-in berhasil ditambahkan',
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Admin walk-in error');
    res.status(500).json({ success: false, message: message || 'Internal server error' });
  } finally {
    client.release();
  }
};
