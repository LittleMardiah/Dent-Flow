import { getErrorMessage, getErrorStack } from "../utils/error.util";
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { EncounterService } from './encounter.service';
import { QueueStatus } from '../models/queue.model';

export interface QueuePatient {
  queueId: string;
  queueNumber: number;
  bookingId: string;
  patientId: string;
  patientName: string;
  bookingTime: Date;
  checkInTime: Date;
  calledAt?: Date;
  status: QueueStatus;
}

export interface QueueStats {
  totalWaiting: number;
  totalBeingCalled: number;
  totalCompleted: number;
  averageWaitTimeMinutes: number;
}

export class DoctorQueueService {
  private pool: Pool;
  private encounterService: EncounterService;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
    this.encounterService = new EncounterService();
  }

  async getQueueForDoctor(doctorId: string, branchId: string): Promise<QueuePatient[]> {
    try {
      const query = `
        SELECT 
          q.id as queue_id,
          q.queue_number,
          q.booking_id,
          b.patient_id,
          u.username as patient_name,
          b.booking_date as booking_time,
          q.created_at as check_in_time,
          q.called_at,
          q.status
        FROM queues q
        JOIN bookings b ON q.booking_id = b.id
        JOIN patients p ON b.patient_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE q.doctor_id = $1
          AND q.branch_id = $2
          AND DATE(q.created_at) = CURRENT_DATE
          AND q.status IN ('WAITING', 'BEING_CALLED')
        ORDER BY q.queue_number ASC
      `;
      const result = await this.pool.query(query, [doctorId, branchId]);
      return result.rows.map(row => ({
        queueId: row.queue_id,
        queueNumber: row.queue_number,
        bookingId: row.booking_id,
        patientId: row.patient_id,
        patientName: row.patient_name,
        bookingTime: row.booking_time,
        checkInTime: row.check_in_time,
        calledAt: row.called_at,
        status: row.status,
      }));
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Error fetching doctor queue');
      throw new Error('Failed to fetch doctor queue');
    }
  }

  async checkInPatient(queueId: string, doctorId: string): Promise<{ queue: any; encounter: any }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const queueResult = await client.query(
        `SELECT q.*, b.branch_id 
         FROM queues q
         JOIN bookings b ON q.booking_id = b.id
         WHERE q.id = $1`,
        [queueId]
      );
      if (queueResult.rows.length === 0) {
        throw new Error('QUEUE_NOT_FOUND');
      }
      const queue = queueResult.rows[0];

      if (queue.doctor_id !== doctorId) {
        throw new Error('QUEUE_NOT_OWNED_BY_DOCTOR');
      }

      if (queue.status !== 'WAITING') {
        throw new Error('QUEUE_NOT_WAITING');
      }

      const updateResult = await client.query(
        `UPDATE queues 
         SET status = 'BEING_CALLED', called_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [queueId]
      );
      const updatedQueue = updateResult.rows[0];

      const encounter = await this.encounterService.startEncounter(
        queue.booking_id,
        doctorId,
        queue.branch_id
      );

      await auditService.logEvent({
        branchId: queue.branch_id,
        userId: doctorId,
        eventType: AuditEventType.QUEUE_CALLED,
        entityType: 'QUEUE',
        entityId: queueId,
        description: `Dokter memulai pelayanan pasien dengan nomor antrian ${queue.queue_number}`,
        newValues: { queueStatus: 'BEING_CALLED', encounterId: encounter.id },
      });

      await client.query('COMMIT');
      return { queue: updatedQueue, encounter };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Error in checkInPatient');
      throw error;
    } finally {
      client.release();
    }
  }

  async getQueueStats(doctorId: string, branchId: string): Promise<QueueStats> {
    try {
      const query = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'WAITING') as total_waiting,
          COUNT(*) FILTER (WHERE status = 'BEING_CALLED') as total_being_called,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as total_completed,
          AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) FILTER (WHERE status = 'WAITING') as avg_wait_minutes
        FROM queues
        WHERE doctor_id = $1
          AND branch_id = $2
          AND DATE(created_at) = CURRENT_DATE
      `;
      const result = await this.pool.query(query, [doctorId, branchId]);
      const row = result.rows[0];
      return {
        totalWaiting: parseInt(row.total_waiting) || 0,
        totalBeingCalled: parseInt(row.total_being_called) || 0,
        totalCompleted: parseInt(row.total_completed) || 0,
        averageWaitTimeMinutes: parseFloat(row.avg_wait_minutes) || 0,
      };
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Error fetching queue stats');
      throw new Error('Failed to fetch queue stats');
    }
  }

  // ========== STUB METHODS (UNTUK COMPILE) ==========
  /**
   * STUB: Call next patient
   * TODO: Implementasi lengkap
   */
  async callNextPatient(doctorId: string, branchId: string): Promise<any> {
    // Untuk sementara, throw error dulu
    throw new Error('callNextPatient not implemented yet');
  }

  /**
   * STUB: Complete patient
   * TODO: Implementasi lengkap
   */
  async completePatient(queueId: string, doctorId: string): Promise<any> {
    // Untuk sementara, throw error dulu
    throw new Error('completePatient not implemented yet');
  }
}

export const doctorQueueService = new DoctorQueueService();