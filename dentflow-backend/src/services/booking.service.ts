import { getErrorMessage } from "../utils/error.util";
import { Pool } from 'pg';
import { NotificationService } from "./notification.service";

import { logger } from '../utils/logger';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { slotAvailabilityService } from './slotAvailability.service';
import { pool } from '../config/database';

export class BookingService {
  private notificationService: NotificationService;
  private pool: Pool;

  constructor() {
    this.pool = pool;
    this.notificationService = new NotificationService();
  }

  async createScheduledBooking(
    patientId: string,
    doctorUserId: string,
    branchId: string,
    bookingDate: Date,
    sessionSlotId: string,
    _notes?: string
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 0. Get patient record ID
      let patientRecordId: string;
      const patientResult = await client.query(
        `SELECT id FROM patients WHERE user_id = $1`,
        [patientId]
      );
      if (patientResult.rows.length === 0) {
        const insertPatient = await client.query(
          `INSERT INTO patients (user_id, full_name, branch_id) VALUES ($1, (SELECT username FROM users WHERE id = $1), $2) RETURNING id`,
          [patientId, branchId]
        );
        patientRecordId = insertPatient.rows[0].id;
      } else {
        patientRecordId = patientResult.rows[0].id;
      }

      // 1. Get doctor record ID
      const doctorResult = await client.query(
        `SELECT id FROM doctors WHERE user_id = $1 AND branch_id = $2 AND is_available = true`,
        [doctorUserId, branchId]
      );
      if (doctorResult.rows.length === 0) {
        throw new Error('DOCTOR_NOT_FOUND');
      }
      const doctorRecordId = doctorResult.rows[0].id;

      // 2. Ambil jadwal dari sessionSlotId (UUID)
      const scheduleResult = await client.query(
        `SELECT session_start, session_end, max_patients_per_session 
         FROM doctor_schedules 
         WHERE id = $1 AND is_active = true`,
        [sessionSlotId]
      );
      if (scheduleResult.rows.length === 0) {
        throw new Error('DOCTOR_NOT_SCHEDULED');
      }
      const schedule = scheduleResult.rows[0];
      const timeStr = schedule.session_start;

      const dateStr = bookingDate.toISOString().split('T')[0];
      const sessionStartTimestamp = `${dateStr} ${timeStr}`;
      const sessionEndTimestamp = `${dateStr} ${schedule.session_end}`;

      // 3. Check slot availability using slotAvailabilityService
      const isAvailable = await slotAvailabilityService.checkSlotAvailability(
        doctorRecordId,
        sessionStartTimestamp,
        sessionEndTimestamp,
        bookingDate
      );
      if (!isAvailable) {
        throw new Error('SLOT_NOT_AVAILABLE');
      }

      // 4. Generate booking code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 5. Insert booking
      const result = await client.query(
        `INSERT INTO bookings 
         (branch_id, patient_id, doctor_id, booking_date, booking_time, session_start, session_end, status, booking_code, check_in_code, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_PAYMENT', $8, $9, NOW(), NOW())
         RETURNING id`,
        [branchId, patientRecordId, doctorRecordId, bookingDate, timeStr, sessionStartTimestamp, sessionEndTimestamp, code, code]
      );
      const bookingId = result.rows[0].id;

      // 6. Audit log
      await auditService.logEvent({
        branchId,
        userId: patientId,
        eventType: AuditEventType.BOOKING_CREATED,
        entityType: 'BOOKING',
        entityId: bookingId,
        description: `Booking created for patient ${patientId}`,
      });

      // Send booking confirmation notification
      await this.notificationService.sendBookingConfirmation(bookingId);
      logger.info({ msg: "📧 Booking confirmation sent", bookingId });
      await client.query('COMMIT');

      return { bookingId, bookingCode: code };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      logger.error({ error: getErrorMessage(error) }, 'Booking creation failed');
      throw error;
    } finally {
      client.release();
    }
  }
}
