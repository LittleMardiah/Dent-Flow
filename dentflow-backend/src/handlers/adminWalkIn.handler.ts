import { Request, Response } from 'express';

import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { PasswordService } from '../utils/password.utils';
import { broadcastQueueUpdated } from '../websocket';
import { pool } from '../config/database';


export const adminWalkInCheckin = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Dukung payload camelCase (web) ATAU snake_case (API lama)
    const name = req.body.name;
    const phone = req.body.phone || '';
    const age = req.body.age;
    const complaint = req.body.complaint;
    const doctorId = req.body.doctorId ?? req.body.doctor_id;
    const branchId = req.body.branchId ?? req.body.branch_id;
    const walkInUserId = req.body.walkInUserId ?? req.body.walk_in_user_id;
    const adminId = req.user?.userId;

    if (!name || !doctorId || !branchId) {
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

    // 0. Resolve doctor record: terima doctor record id ATAU user id dokter
    const doctorRes = await client.query(
      `SELECT id FROM doctors WHERE id = $1 OR user_id = $1 LIMIT 1`,
      [doctorId]
    );
    if (doctorRes.rows.length === 0) {
      throw new Error('DOCTOR_NOT_FOUND');
    }
    const realDoctorId = doctorRes.rows[0].id;

    // 1. Resolve existing patient record (sediakan opsi pemanggil menentukan user id pasien)
    let patientId: string;
    if (walkInUserId) {
      const patientRes = await client.query(
        `SELECT id FROM patients WHERE user_id = $1 LIMIT 1`,
        [walkInUserId]
      );
      if (patientRes.rows.length === 0) {
        throw new Error('PATIENT_NOT_FOUND');
      }
      patientId = patientRes.rows[0].id;
    } else {
      // Buat user + patient baru agar nama walk-in muncul di antrian
      const suffix = Math.random().toString(36).substring(2, 10);
      const email = `walkin_${suffix}@clinic.com`;
      const username = `walkin_${suffix}`;
      const passwordHash = await PasswordService.hashPassword('Walkin123!');

      const userResult = await client.query(
        `INSERT INTO users (branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, 'PATIENT', $2, $3, $4, true)
         RETURNING id`,
        [branchId, email, username, passwordHash]
      );
      const userId = userResult.rows[0].id;

      const patientResult = await client.query(
        `INSERT INTO patients (branch_id, user_id, full_name, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [branchId, userId, name, phone]
      );
      patientId = patientResult.rows[0].id;
    }

    // 2. Insert temporary patient (walk-in semantics)
    const tempResult = await client.query(
      `INSERT INTO temporary_patients (branch_id, full_name, phone)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [branchId, name, phone]
    );
    const tempPatientId = tempResult.rows[0].id;

    // 3. Create booking
    const today = new Date();
    const bookingDate = today.toISOString().split('T')[0];
    const sessionStart = `${bookingDate} 09:00:00`;
    const sessionEnd = `${bookingDate} 12:00:00`;
    const bookingTime = '09:00:00';
    const bookingCode = `E2E-WK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const bookingResult = await client.query(
      `INSERT INTO bookings
       (branch_id, patient_id, doctor_id, status, booking_date, booking_time,
        session_start, session_end, booking_code, temp_patient_id, patient_notes, is_walk_in, dp_amount)
       VALUES ($1, $2, $3, 'PAYMENT_CONFIRMED', $4, $5, $6, $7, $8, $9, $10, true, 0)
       RETURNING id`,
      [branchId, patientId, realDoctorId, bookingDate, bookingTime,
       sessionStart, sessionEnd, bookingCode, tempPatientId, complaint || null]
    );
    const bookingId = bookingResult.rows[0].id;

    // 4. Generate queue number (per dokter per cabang per hari)
    const queueCount = await client.query(
      `SELECT COUNT(*) as count FROM queues
       WHERE doctor_id = $1 AND branch_id = $2 AND DATE(created_at) = CURRENT_DATE
         AND deleted_at IS NULL`,
      [realDoctorId, branchId]
    );
    const queueNumber = parseInt(queueCount.rows[0].count) + 1;

    // 5. Insert queue
    await client.query(
      `INSERT INTO queues (booking_id, doctor_id, branch_id, queue_number, status)
       VALUES ($1, $2, $3, $4, 'WAITING')`,
      [bookingId, realDoctorId, branchId, queueNumber]
    );

    await client.query('COMMIT');

    broadcastQueueUpdated({
      branchId,
      doctorId: realDoctorId,
      action: 'walk-in',
    });

    res.status(201).json({
      success: true,
      data: {
        queue_number: queueNumber,
        temp_patient_id: tempPatientId,
        booking_id: bookingId,
        patient_id: patientId,
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