import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { QueueService } from './queue.service';
import { PasswordService } from '../utils/password.utils';
import { JwtService } from '../utils/jwt.utils';
import { CreateTemporaryPatientInput, TemporaryPatient } from '../models/temporaryPatient.model';

export class WalkInService {
  private pool: Pool;
  private queueService: QueueService;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
    this.queueService = new QueueService();
  }

  async createTemporaryProfile(input: CreateTemporaryPatientInput): Promise<TemporaryPatient> {
    try {
      const result = await this.pool.query(
        `INSERT INTO temporary_patients (branch_id, full_name, phone, age)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [input.branchId, input.fullName, input.phone, input.age || null]
      );
      const row = result.rows[0];
      return {
        id: row.id,
        branchId: row.branch_id,
        fullName: row.full_name,
        phone: row.phone,
        age: row.age,
        convertedToPatientId: row.converted_to_patient_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error creating temporary profile');
      throw new Error('Failed to create temporary profile');
    }
  }

  async bookAppointment(
    tempPatientId: string,
    doctorId: string,
    branchId: string,
    _sessionSlotId: string,
    bookingDate: Date
  ): Promise<{ bookingId: string; queueNumber: number }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Cek temporary patient
      const tempResult = await client.query(
        `SELECT * FROM temporary_patients WHERE id = $1 AND deleted_at IS NULL`,
        [tempPatientId]
      );
      if (tempResult.rows.length === 0) {
        throw new Error('TEMP_PATIENT_NOT_FOUND');
      }
      const tempPatient = tempResult.rows[0];

      // 2. Cek dokter (user)
      const doctorResult = await client.query(
        `SELECT * FROM users WHERE id = $1 AND role = 'DOCTOR' AND is_active = true AND deleted_at IS NULL`,
        [doctorId]
      );
      if (doctorResult.rows.length === 0) {
        throw new Error('DOCTOR_NOT_FOUND');
      }

      // ===== VALIDASI SLOT (DIPINJAM DARI BOOKING SERVICE) =====
      // 2a. Dapatkan doctor record ID dari tabel doctors
      const doctorRecordResult = await client.query(
        `SELECT id FROM doctors WHERE user_id = $1 AND branch_id = $2 AND is_available = true`,
        [doctorId, branchId]
      );
      if (doctorRecordResult.rows.length === 0) {
        throw new Error('DOCTOR_RECORD_NOT_FOUND');
      }
      const doctorRecordId = doctorRecordResult.rows[0].id;

      // 2b. Ambil jadwal dari sessionSlotId
      const scheduleResult = await client.query(
        `SELECT session_start, session_end, max_patients_per_session 
         FROM doctor_schedules 
         WHERE id = $1 AND is_active = true`,
        [_sessionSlotId]
      );
      if (scheduleResult.rows.length === 0) {
        throw new Error('DOCTOR_NOT_SCHEDULED');
      }
      const schedule = scheduleResult.rows[0];
      const timeStr = schedule.session_start;
      const dateStr = bookingDate.toISOString().split('T')[0];
      const sessionStartTimestamp = `${dateStr} ${timeStr}`;

      // 2c. Hitung booking aktif di sesi tersebut
      const bookingCountResult = await client.query(
        `SELECT COUNT(*) as booked 
         FROM bookings 
         WHERE doctor_id = $1 
           AND session_start = $2 
           AND booking_date = $3 
           AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
        [doctorRecordId, sessionStartTimestamp, bookingDate]
      );
      const booked = parseInt(bookingCountResult.rows[0].booked);

      // 2d. Cek apakah sudah penuh (max 4)
      if (booked >= schedule.max_patients_per_session) {
        throw new Error('SLOT_NOT_AVAILABLE');
      }
      // ========================================================

      // 3. Generate queue number
      const queueNumber = await this.queueService.getNextQueueNumber(
        branchId,
        doctorId,
        bookingDate
      );

      // 4. Generate booking code
      const bookingCode = this.generateBookingCode();

      // 5. Insert booking
      const bookingResult = await client.query(
        `INSERT INTO bookings (
          branch_id, pasien_id, dokter_id, booking_date, session_start, session_end,
          status, check_in_code, dp_amount, is_walk_in, temp_patient_id, queue_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          branchId,
          null,
          doctorId,
          bookingDate,
          sessionStartTimestamp,
          `${dateStr} ${schedule.session_end}`,
          'PAYMENT_CONFIRMED',
          bookingCode,
          0,
          true,
          tempPatientId,
          queueNumber,
        ]
      );
      const booking = bookingResult.rows[0];

      // 6. Insert queue
      await client.query(
        `INSERT INTO queues (
          branch_id, booking_id, dokter_id, patient_id, queue_number, queue_date, status, check_in_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          branchId,
          booking.id,
          doctorId,
          null,
          queueNumber,
          bookingDate,
          'WAITING',
          new Date(),
        ]
      );

      // 7. Audit log
      await auditService.logEvent({
        branchId,
        userId: tempPatient.id,
        eventType: AuditEventType.WALK_IN_ADDED,
        entityType: 'BOOKING',
        entityId: booking.id,
        description: `Walk-in appointment booked for ${tempPatient.full_name}`,
        newValues: { tempPatientId, doctorId, queueNumber },
      });

      await client.query('COMMIT');
      return { bookingId: booking.id, queueNumber };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error booking walk-in appointment');
      throw error;
    } finally {
      client.release();
    }
  }

  async convertTemporaryToPatient(
    tempPatientId: string,
    email: string,
    password: string
  ): Promise<{ patientId: string; token: string; refreshToken: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const tempResult = await client.query(
        `SELECT * FROM temporary_patients WHERE id = $1 AND deleted_at IS NULL`,
        [tempPatientId]
      );
      if (tempResult.rows.length === 0) {
        throw new Error('TEMP_PATIENT_NOT_FOUND');
      }
      const tempPatient = tempResult.rows[0];

      if (tempPatient.converted_to_patient_id) {
        throw new Error('TEMP_PATIENT_ALREADY_CONVERTED');
      }

      const existingUser = await client.query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );
      if (existingUser.rows.length > 0) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }

      const passwordHash = await PasswordService.hashPassword(password);

      const userResult = await client.query(
        `INSERT INTO users (branch_id, role, email, password_hash, full_name, phone_number, patient_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          tempPatient.branch_id,
          'PATIENT',
          email,
          passwordHash,
          tempPatient.full_name,
          tempPatient.phone,
          'REGISTERED',
        ]
      );
      const newUser = userResult.rows[0];

      await client.query(
        `INSERT INTO patients (branch_id, user_id, full_name, phone)
         VALUES ($1, $2, $3, $4)`,
        [tempPatient.branch_id, newUser.id, tempPatient.full_name, tempPatient.phone]
      );

      await client.query(
        `UPDATE bookings 
         SET pasien_id = $1, temp_patient_id = NULL, updated_at = NOW()
         WHERE temp_patient_id = $2 AND deleted_at IS NULL`,
        [newUser.id, tempPatientId]
      );

      await client.query(
        `UPDATE queues 
         SET patient_id = $1, updated_at = NOW()
         WHERE booking_id IN (
           SELECT id FROM bookings WHERE pasien_id = $1
         ) AND deleted_at IS NULL`,
        [newUser.id]
      );

      await client.query(
        `UPDATE temporary_patients 
         SET converted_to_patient_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [newUser.id, tempPatientId]
      );

      await auditService.logEvent({
        branchId: tempPatient.branch_id,
        userId: newUser.id,
        eventType: 'WALK_IN_CONVERTED',
        entityType: 'USER',
        entityId: newUser.id,
        description: `Temporary profile converted to full patient account for ${tempPatient.full_name}`,
        oldValues: { tempPatientId },
        newValues: { patientId: newUser.id, email },
      });

      const token = JwtService.generateToken({
        userId: newUser.id,
        branchId: tempPatient.branch_id,
        role: 'PATIENT',
        email,
      });
      const refreshToken = JwtService.generateRefreshToken(newUser.id);

      return { patientId: newUser.id, token, refreshToken };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error converting temp patient');
      throw error;
    } finally {
      client.release();
    }
  }

  private generateBookingCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}