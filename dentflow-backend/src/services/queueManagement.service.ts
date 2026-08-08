import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { QueueService } from './queue.service';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export interface QueuePatient {
  queueId: string;
  queueNumber: number;
  bookingId: string;
  patientId: string;
  patientName: string;
  bookingTime: Date;
  checkInTime: Date;
  calledAt?: Date;
  status: string;
}

export interface QueueStats {
  totalWaiting: number;
  totalBeingCalled: number;
  totalCompleted: number;
  averageWaitTimeMinutes: number;
}

export class QueueManagementService {
  private pool: Pool;
  private queueService: QueueService;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
    this.queueService = new QueueService();
  }

  async getQueueForDoctor(doctorId: string, branchId: string): Promise<QueuePatient[]> {
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
        AND q.status IN ('WAITING', 'BEING_CALLED')
        AND q.deleted_at IS NULL
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
  }

  async getQueueStats(doctorId: string, branchId: string): Promise<QueueStats> {
    const query = `
      SELECT 
        COUNT(CASE WHEN status = 'WAITING' THEN 1 END) as waiting,
        COUNT(CASE WHEN status = 'BEING_CALLED' THEN 1 END) as being_called,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
        AVG(EXTRACT(EPOCH FROM (called_at - created_at))) as avg_wait_seconds
      FROM queues
      WHERE doctor_id = $1 
        AND branch_id = $2
        AND deleted_at IS NULL
        AND created_at >= CURRENT_DATE
    `;
    const result = await this.pool.query(query, [doctorId, branchId]);
    const row = result.rows[0];
    return {
      totalWaiting: parseInt(row.waiting) || 0,
      totalBeingCalled: parseInt(row.being_called) || 0,
      totalCompleted: parseInt(row.completed) || 0,
      averageWaitTimeMinutes: Math.round((parseFloat(row.avg_wait_seconds) || 0) / 60),
    };
  }

  async callNextPatient(doctorId: string, branchId: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE queues 
         SET status = 'BEING_CALLED', called_at = NOW()
         WHERE id = (
           SELECT id FROM queues 
           WHERE doctor_id = $1 AND branch_id = $2 AND status = 'WAITING'
           ORDER BY queue_number ASC
           LIMIT 1
         )
         RETURNING *`,
        [doctorId, branchId]
      );
      await client.query('COMMIT');
      return result.rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async completePatient(queueId: string, doctorId: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE queues 
         SET status = 'COMPLETED', completed_at = NOW()
         WHERE id = $1 AND doctor_id = $2
         RETURNING *`,
        [queueId, doctorId]
      );
      await client.query('COMMIT');
      return result.rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async resetAllQueuesForDate(date: Date = new Date()): Promise<void> {
    await this.queueService.resetAllQueuesForDate(date);
  }
}
