import { getCurrentTime } from "../utils/time";
import { Request, Response } from 'express';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

const pool = new Pool({ connectionString: config.database.url });

export const checkInPatient = async (req: Request, res: Response) => {
  // Placeholder
  return res.status(200).json({ success: true, data: { queue_id: 'dummy' } });
};

export const addWalkIn = async (req: Request, res: Response) => {
  try {
    const { name, phone, doctor_id, branch_id } = req.body;
    logger.info({ msg: 'Walk-in request', name, phone, doctor_id, branch_id });

    if (!name || !doctor_id || !branch_id) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    // 1. Insert temporary patient (gunakan kolom 'name', bukan 'full_name')
    const tempResult = await pool.query(
      `INSERT INTO temporary_patients (name, phone, branch_id) 
       VALUES ($1, $2, $3) RETURNING id`,
      [name, phone, branch_id]
    );
    const tempPatientId = tempResult.rows[0].id;

    // 2. Dapatkan patient_id dari seed user
    const patientRes = await pool.query(
      `SELECT id FROM patients WHERE user_id = 'd83659a9-6657-4c3e-a488-923e3d3d52c0' LIMIT 1`
    );
    if (patientRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Patient not found' });
    }
    const patientId = patientRes.rows[0].id;

    // 3. Dapatkan real doctor_id
    const doctorRes = await pool.query(
      `SELECT id FROM doctors WHERE user_id = $1 LIMIT 1`,
      [doctor_id]
    );
    if (doctorRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Doctor not found' });
    }
    const realDoctorId = doctorRes.rows[0].id;

    // 4. Buat booking dengan session unik (09:00-12:00)
    const today = getCurrentTime();
    const bookingDate = today.toISOString().split('T')[0];
    const sessionStart = `${bookingDate} 09:00:00`;
    const sessionEnd = `${bookingDate} 12:00:00`;
    const bookingTime = '09:00:00';
    const bookingCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const bookingResult = await pool.query(
      `INSERT INTO bookings 
       (branch_id, patient_id, doctor_id, status, booking_date, booking_time, session_start, session_end, booking_code, temp_patient_id) 
       VALUES ($1, $2, $3, 'PAYMENT_CONFIRMED', $4, $5, $6, $7, $8, $9) 
       RETURNING id`,
      [branch_id, patientId, realDoctorId, bookingDate, bookingTime, sessionStart, sessionEnd, bookingCode, tempPatientId]
    );
    const bookingId = bookingResult.rows[0].id;

    // 5. Queue number
    const queueCount = await pool.query(
      `SELECT COUNT(*) as count FROM queues 
       WHERE doctor_id = $1 AND branch_id = $2 AND DATE(created_at) = CURRENT_DATE`,
      [realDoctorId, branch_id]
    );
    const queueNumber = parseInt(queueCount.rows[0].count) + 1;

    // 6. Insert queue
    await pool.query(
      `INSERT INTO queues (booking_id, doctor_id, branch_id, queue_number, status) 
       VALUES ($1, $2, $3, $4, 'WAITING')`,
      [bookingId, realDoctorId, branch_id, queueNumber]
    );

    res.status(201).json({
      success: true,
      data: { queue_number: queueNumber, temp_patient_id: tempPatientId, booking_id: bookingId }
    });
  } catch (error: any) {
    logger.error({ msg: 'Walk-in error', error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};
