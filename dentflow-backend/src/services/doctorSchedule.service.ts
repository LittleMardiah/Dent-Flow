import { getErrorMessage, getErrorStack } from "../utils/error.util";
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface TimeSlot {
  start: string; // HH:mm
  end: string;   // HH:mm
  available: boolean;
}

export class DoctorScheduleService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  /**
   * Get available slots for a doctor on a specific date
   * Returns 30-minute slots based on doctor's schedule,
   * excluding booked slots and leave days.
   */
  async getDoctorAvailability(
    doctorId: string,
    branchId: string,
    date: Date
  ): Promise<TimeSlot[]> {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday...

    // 1. Check if doctor is on leave on this date
    const leaveCheck = await this.pool.query(
      `SELECT id FROM doctor_leaves 
       WHERE doctor_id = $1 AND branch_id = $2 
       AND start_date <= $3 AND end_date >= $3`,
      [doctorId, branchId, dateStr]
    );
    if (leaveCheck.rows.length > 0) {
      return []; // No availability on leave days
    }

    // 2. Get doctor's schedule for this day
    const scheduleResult = await this.pool.query(
      `SELECT session_start, session_end, slot_duration_minutes 
       FROM doctor_schedules 
       WHERE dokter_id = $1 AND branch_id = $2 
       AND day_of_week = $3 AND is_active = true`,
      [doctorId, branchId, dayOfWeek]
    );
    if (scheduleResult.rows.length === 0) {
      return [];
    }

    // 3. Get all bookings for this doctor on this date
    const bookingsResult = await this.pool.query(
      `SELECT booking_time 
       FROM bookings 
       WHERE doctor_id = $1 AND branch_id = $2 
       AND booking_date = $3 
       AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
      [doctorId, branchId, dateStr]
    );
    const bookedTimes = bookingsResult.rows.map(row => row.booking_time.substring(0, 5)); // HH:mm

    // 4. Generate slots based on schedule
    const slots: TimeSlot[] = [];
    const schedule = scheduleResult.rows[0];
    const startMinutes = this.timeToMinutes(schedule.session_start);
    const endMinutes = this.timeToMinutes(schedule.session_end);
    const duration = schedule.slot_duration_minutes || 30;

    for (let t = startMinutes; t < endMinutes; t += duration) {
      const startStr = this.minutesToTime(t);
      const endStr = this.minutesToTime(t + duration);
      // Check if this slot is booked (any booking that overlaps)
      const isBooked = bookedTimes.some(booked => {
        const bookedStart = this.timeToMinutes(booked);
        return bookedStart < t + duration && bookedStart + duration > t;
      });
      slots.push({
        start: startStr,
        end: endStr,
        available: !isBooked,
      });
    }

    return slots;
  }

  /**
   * Check if a specific slot is booked
   */
  async isSlotBooked(
    doctorId: string,
    slotDateTime: Date
  ): Promise<boolean> {
    const dateStr = slotDateTime.toISOString().split('T')[0];
    const timeStr = slotDateTime.toTimeString().substring(0, 5);

    const result = await this.pool.query(
      `SELECT id FROM bookings 
       WHERE doctor_id = $1 
       AND booking_date = $2 
       AND booking_time = $3::time 
       AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
      [doctorId, dateStr, timeStr]
    );
    return result.rows.length > 0;
  }

  /**
   * Set doctor on leave for a date range (admin only)
   */
  async setDoctorLeave(
    doctorId: string,
    branchId: string,
    startDate: Date,
    endDate: Date,
    reason: string,
    createdBy: string
  ): Promise<void> {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

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
   * Remove leave for a specific doctor and date range
   */
  async removeDoctorLeave(
    doctorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    await this.pool.query(
      `DELETE FROM doctor_leaves 
       WHERE doctor_id = $1 
       AND start_date >= $2 AND end_date <= $3`,
      [doctorId, startStr, endStr]
    );
    logger.info(`✅ Doctor ${doctorId} leave removed from ${startStr} to ${endStr}`);
  }

  // Utility: convert HH:mm to minutes since midnight
  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  // Utility: convert minutes since midnight to HH:mm
  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
