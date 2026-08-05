import { getErrorMessage } from "../utils/error.util";
import { getCurrentTime } from "../utils/time";
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import redis from '../config/redis';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';

export class CheckinService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  async checkinPatient(checkInCode: string, branchId: string, adminId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const bookingResult = await client.query(
        `SELECT b.id, b.status, b.patient_id, b.doctor_id, b.session_start, b.session_end, 
                b.checked_in_at, b.branch_id
         FROM bookings b
         WHERE b.check_in_code = $1`,
        [checkInCode]
      );

      if (bookingResult.rows.length === 0) {
        throw new Error('KODE_TIDAK_VALID');
      }

      const booking = bookingResult.rows[0];

      if (booking.branch_id !== branchId) {
        throw new Error('BRANCH_TIDAK_SESUAI');
      }

      if (booking.status !== 'PAYMENT_CONFIRMED' && booking.status !== 'CONFIRMED') {
        throw new Error('STATUS_TIDAK_VALID');
      }

      if (booking.checked_in_at) {
        const existingQueue = await client.query(
          `SELECT queue_number FROM queues WHERE booking_id = $1 AND status != 'COMPLETED'`,
          [booking.id]
        );
        if (existingQueue.rows.length > 0) {
          return {
            alreadyCheckedIn: true,
            queueNumber: existingQueue.rows[0].queue_number,
          };
        }
        throw new Error('SUDAH_CHECK_IN');
      }

      const now = getCurrentTime();
      const sessionStart = new Date(booking.session_start + 'Z');
      const sessionEnd = new Date(booking.session_end + 'Z');

      if (now < sessionStart) {
        throw new Error('SESI_BELUM_DIMULAI');
      }
      if (now > sessionEnd) {
        throw new Error('SESI_SUDAH_BERAKHIR');
      }

      const doctorId = booking.doctor_id;
      const queueNumber = await redis.incr(`queue:${branchId}:${doctorId}`);

      await client.query(
        `INSERT INTO queues (branch_id, booking_id, doctor_id, queue_number, status)
         VALUES ($1, $2, $3, $4, 'WAITING')`,
        [branchId, booking.id, doctorId, queueNumber]
      );

      await client.query(
        `UPDATE bookings 
         SET status = 'CHECKED_IN', checked_in_at = $1, queue_number = $2, updated_at = NOW()
         WHERE id = $3`,
        [now, queueNumber, booking.id]
      );

      await auditService.logEvent({
        branchId,
        userId: adminId,
        eventType: AuditEventType.BOOKING_CHECKED_IN,
        entityType: 'BOOKING',
        entityId: booking.id,
        description: `Admin check-in pasien dengan kode ${checkInCode}, queue number ${queueNumber}`,
      });

      await client.query('COMMIT');

      return {
        alreadyCheckedIn: false,
        queueNumber,
        bookingId: booking.id,
        patientId: booking.patient_id,
        doctorId: booking.doctor_id,
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      logger.error({ error: getErrorMessage(error), checkInCode, branchId }, 'Check-in failed');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const checkinService = new CheckinService();
