import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../services/booking.service';
import { logger } from '../utils/logger';
import { pool } from '../config/database';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

const bookingService = new BookingService();

export const createScheduledBooking = async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const patientId = req.user?.userId;
    const branchId = req.user?.branchId;
    if (!patientId || !branchId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { doctorId, bookingDate, sessionSlotId, notes } = req.body;
    if (!doctorId || !bookingDate || !sessionSlotId) {
      return res.status(400).json({ success: false, message: 'Missing required fields: doctorId, bookingDate, sessionSlotId' });
    }

    const result = await bookingService.createScheduledBooking(
      patientId,
      doctorId,
      branchId,
      new Date(bookingDate),
      sessionSlotId,
      notes
    );

    res.status(201).json({ success: true, data: result });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    console.error('Handler error:', error);
    if (message === 'DOCTOR_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });
    }
    if (message === 'DOCTOR_NOT_SCHEDULED') {
      return res.status(400).json({ success: false, message: 'Dokter tidak memiliki jadwal pada waktu tersebut' });
    }
    if (message === 'SLOT_NOT_AVAILABLE') {
      return res.status(409).json({ success: false, message: 'Slot sudah penuh (maksimal 4 pasien per sesi)' });
    }
    if (message === 'FAILED_TO_GENERATE_BOOKING_CODE') {
      return res.status(500).json({ success: false, message: 'Gagal generate kode booking, silakan coba lagi' });
    }

    logger.error({ error: message, stack }, 'Create booking error');
    res.status(500).json({ 
      success: false, 
      message: message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? stack : undefined
    });
  }
};

export const getPatientBookings = async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const patientId = req.user?.userId;
    if (!patientId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const result = await pool.query(
      `SELECT b.id, b.booking_code, b.status, b.session_start, b.session_end, b.created_at,
        d.full_name AS doctor_name
       FROM bookings b
       LEFT JOIN doctors d ON b.doctor_id = d.id
       WHERE b.patient_id = (SELECT id FROM patients WHERE user_id = $1)
       ORDER BY b.created_at DESC`,
      [patientId]
    );
    res.status(200).json({ success: true, data: { bookings: result.rows } });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Get patient bookings error');
    _next(error);
  }
};

export const getBookingDetail = async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const userBranch = req.user?.branchId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const patientRecord = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );
    const patientId = patientRecord.rows[0]?.id;

    const result = await pool.query(
      `SELECT 
        b.id, b.branch_id, b.patient_id, b.doctor_id, b.booking_date,
        b.booking_time, b.status, b.booking_code, b.is_walk_in,
        b.session_start, b.session_end, b.created_at,
        d.full_name as doctor_name
      FROM bookings b
      LEFT JOIN doctors d ON b.doctor_id = d.id
      WHERE b.id = $1`,
      [bookingId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking tidak ditemukan' });
    }
    const booking = result.rows[0];

    // Authorization
    if (userRole === 'PATIENT' && booking.patient_id !== patientId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (userRole === 'ADMIN_BRANCH' && booking.branch_id !== userBranch) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (userRole === 'DOCTOR' && booking.branch_id !== userBranch) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Get booking detail error');
    _next(error);
  }
};

export const cancelBooking = async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const userBranch = req.user?.branchId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT * FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking tidak ditemukan' });
    }
    const booking = result.rows[0];

    // Authorization
    if (userRole === 'PATIENT') {
      const patientRecord = await pool.query(`SELECT id FROM patients WHERE user_id = $1`, [userId]);
      const patientId = patientRecord.rows[0]?.id;
      if (booking.patient_id !== patientId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      if (['CHECKED_IN', 'COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(booking.status)) {
        return res.status(409).json({ success: false, message: 'Booking tidak dapat dibatalkan' });
      }
    } else if (userRole === 'ADMIN_BRANCH') {
      if (booking.branch_id !== userBranch) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await pool.query(
      `UPDATE bookings SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [bookingId]
    );
    res.status(200).json({ success: true, message: 'Booking berhasil dibatalkan' });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Cancel booking error');
    _next(error);
  }
};
