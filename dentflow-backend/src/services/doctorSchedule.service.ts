import { getErrorMessage, getErrorStack } from "../utils/error.util";
import { Pool } from 'pg';

import { logger } from '../utils/logger';
import { slotAvailabilityService } from './slotAvailability.service';
import { pool } from '../config/database';

export interface DoctorScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxPatients?: number;
}

export class DoctorScheduleService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  /**
   * Replace doctor weekly schedule for a branch
   */
  async updateDoctorSchedule(
    doctorId: string,
    branchId: string,
    schedules: DoctorScheduleInput[]
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const doctorResult = await client.query(
        `SELECT id, user_id FROM doctors WHERE id = $1 OR user_id = $1 LIMIT 1`,
        [doctorId]
      );
      if (doctorResult.rows.length === 0) {
        throw new Error('DOCTOR_NOT_FOUND');
      }
      const doctorUserId = doctorResult.rows[0].user_id;

      await client.query(
        `DELETE FROM doctor_schedules WHERE dokter_id = $1 AND branch_id = $2`,
        [doctorUserId, branchId]
      );

      for (const schedule of schedules) {
        await client.query(
          `INSERT INTO doctor_schedules
             (branch_id, dokter_id, day_of_week, session_start, session_end,
              max_patients_per_session, slot_duration_minutes, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
          [
            branchId,
            doctorUserId,
            schedule.dayOfWeek,
            schedule.startTime,
            schedule.endTime,
            schedule.maxPatients ?? 4,
            30,
          ]
        );
      }

      await client.query('COMMIT');
      logger.info(
        `✅ Doctor ${doctorId} schedule updated (${schedules.length} entries) for branch ${branchId}`
      );
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      logger.error(
        { error: getErrorMessage(error), stack: getErrorStack(error) },
        'Failed to update doctor schedule'
      );
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get available slots for a doctor on a specific date
   */
  async getDoctorAvailability(
    doctorId: string,
    branchId: string,
    date: Date
  ): Promise<any[]> {
    return slotAvailabilityService.getAvailableSlots(doctorId, branchId, date);
  }

  /**
   * Set doctor leave
   */
  async setDoctorLeave(
    doctorId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    reason: string,
    createdBy: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      await client.query(
        `INSERT INTO doctor_leaves (doctor_id, branch_id, start_date, end_date, reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [doctorId, branchId, startStr, endStr, reason, createdBy]
      );
      await client.query('COMMIT');
      logger.info(`✅ Doctor ${doctorId} leave set from ${startStr} to ${endStr}`);
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Failed to set doctor leave');
      throw new Error('LEAVE_SET_FAILED');
    } finally {
      client.release();
    }
  }

  /**
   * Remove doctor leave
   */
  async removeDoctorLeave(
    doctorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const result = await this.pool.query(
      `DELETE FROM doctor_leaves 
       WHERE doctor_id = $1 AND start_date = $2 AND end_date = $3`,
      [doctorId, startStr, endStr]
    );
    logger.info(`🗑️ Removed ${result.rowCount} leave record(s) for doctor ${doctorId}`);
  }
}
