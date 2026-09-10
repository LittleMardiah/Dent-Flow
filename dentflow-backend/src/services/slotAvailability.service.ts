import { Pool } from 'pg';

import { pool } from '../config/database';

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

export class SlotAvailabilityService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  /**
   * Check if a specific slot is available for booking
   */
  async checkSlotAvailability(
    doctorRecordId: string,
    slotStart: string,
    slotEnd: string,
    bookingDate: Date
  ): Promise<boolean> {
    const dateStr = bookingDate.toISOString().split('T')[0];
    const result = await this.pool.query(
      `SELECT COUNT(*) as booked 
       FROM bookings 
       WHERE doctor_id = $1 
         AND session_start = $2 
         AND booking_date = $3 
         AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
      [doctorRecordId, slotStart, dateStr]
    );
    const booked = parseInt(result.rows[0].booked);

    const scheduleResult = await this.pool.query(
      `SELECT max_patients_per_session 
       FROM doctor_schedules 
       WHERE session_start = $1 
         AND is_active = true 
       LIMIT 1`,
      [slotStart.split(' ')[1]]
    );
    const maxPatients = scheduleResult.rows.length > 0 ? parseInt(scheduleResult.rows[0].max_patients_per_session) : 4;
    return booked < maxPatients;
  }

  /**
   * Get available slots for a doctor on a specific date
   */
  async getAvailableSlots(
    doctorId: string,
    branchId: string,
    date: Date
  ): Promise<TimeSlot[]> {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    const leaveCheck = await this.pool.query(
      `SELECT id FROM doctor_leaves 
       WHERE doctor_id = $1 AND branch_id = $2 
       AND start_date <= $3 AND end_date >= $3`,
      [doctorId, branchId, dateStr]
    );
    if (leaveCheck.rows.length > 0) {
      return [];
    }

    const scheduleResult = await this.pool.query(
      `SELECT session_start, session_end, slot_duration_minutes, max_patients_per_session
       FROM doctor_schedules 
       WHERE dokter_id = $1 AND branch_id = $2 
       AND day_of_week = $3 AND is_active = true`,
      [doctorId, branchId, dayOfWeek]
    );
    if (scheduleResult.rows.length === 0) {
      return [];
    }
    const schedule = scheduleResult.rows[0];
    const startMinutes = this.timeToMinutes(schedule.session_start);
    const endMinutes = this.timeToMinutes(schedule.session_end);
    const duration = schedule.slot_duration_minutes || 30;
    const maxPatients = parseInt(schedule.max_patients_per_session) || 4;

    const bookingsResult = await this.pool.query(
      `SELECT session_start, session_end 
       FROM bookings 
       WHERE doctor_id = $1 AND branch_id = $2 
       AND booking_date = $3 
       AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
      [doctorId, branchId, dateStr]
    );
    const bookedSlots = bookingsResult.rows.map(row => ({
      start: row.session_start,
      end: row.session_end,
    }));

    const slots: TimeSlot[] = [];
    for (let t = startMinutes; t < endMinutes; t += duration) {
      const startStr = this.minutesToTime(t);
      const endStr = this.minutesToTime(t + duration);
      const overlapping = bookedSlots.filter(b => {
        const bStart = this.timeToMinutes(b.start.split(' ')[1]);
        const bEnd = this.timeToMinutes(b.end.split(' ')[1]);
        return bStart < t + duration && bEnd > t;
      });
      const available = overlapping.length < maxPatients;
      slots.push({ start: startStr, end: endStr, available });
    }

    return slots;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }
}

export const slotAvailabilityService = new SlotAvailabilityService();
