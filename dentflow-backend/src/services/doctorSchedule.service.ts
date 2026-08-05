import { getErrorMessage, getErrorStack } from "../utils/error.util";
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { slotAvailabilityService } from './slotAvailability.service';

export class DoctorScheduleService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
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
