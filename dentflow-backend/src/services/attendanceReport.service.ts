import { Pool } from 'pg';

import { logger } from '../utils/logger';
import { pool } from '../config/database';

export interface PatientAttendance {
  patientId: string;
  totalBookings: number;
  completed: number;
  noShows: number;
  cancellations: number;
  showRate: number;
}

export interface NoShowSummary {
  patientId: string;
  patientName: string;
  phone: string;
  noShowCount: number;
  lastNoShowDate: Date | null;
  totalBookings: number;
  isWalkIn: boolean;
}

export class AttendanceReportService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  /**
   * Get attendance statistics for a specific patient (regular or walk-in)
   * Supports both patient_id (users) and temp_patient_id (temporary_patients)
   */
  async getPatientAttendanceRate(patientId: string, isWalkIn: boolean = false): Promise<PatientAttendance> {
    try {
      let query: string;
      let params: any[];

      if (isWalkIn) {
        query = `
          SELECT 
            COUNT(*) as total_bookings,
            COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
            COUNT(*) FILTER (WHERE status = 'NO_SHOW') as no_shows,
            COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancellations
          FROM bookings
          WHERE temp_patient_id = $1
        `;
        params = [patientId];
      } else {
        query = `
          SELECT 
            COUNT(*) as total_bookings,
            COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
            COUNT(*) FILTER (WHERE status = 'NO_SHOW') as no_shows,
            COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancellations
          FROM bookings
          WHERE patient_id = $1
        `;
        params = [patientId];
      }

      const result = await this.pool.query(query, params);
      const row = result.rows[0];

      const totalBookings = parseInt(row.total_bookings) || 0;
      const completed = parseInt(row.completed) || 0;
      const noShows = parseInt(row.no_shows) || 0;
      const cancellations = parseInt(row.cancellations) || 0;

      const showRate = totalBookings > 0 ? (completed / totalBookings) * 100 : 0;

      return {
        patientId,
        totalBookings,
        completed,
        noShows,
        cancellations,
        showRate: Math.round(showRate * 100) / 100,
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error fetching patient attendance');
      throw new Error('Failed to fetch patient attendance');
    }
  }

  /**
   * Get no-show summary for a branch (top chronic no-shows)
   * NOW INCLUDES WALK-IN PATIENTS from temporary_patients
   * Returns patients sorted by no-show count descending
   */
  async getNoShowSummary(branchId: string, limit: number = 20): Promise<NoShowSummary[]> {
    try {
      // Query untuk regular patients (dari users)
      const regularQuery = `
        SELECT 
          p.id as patient_id,
          p.full_name as patient_name,
          p.phone as phone,
          COUNT(*) FILTER (WHERE b.status = 'NO_SHOW') as no_show_count,
          MAX(b.no_show_at) as last_no_show_date,
          COUNT(*) as total_bookings,
          false as is_walk_in
        FROM users u
        JOIN patients p ON p.user_id = u.id
        JOIN bookings b ON b.patient_id = p.id
        WHERE u.branch_id = $1
          AND u.role = 'PATIENT'
        GROUP BY p.id, p.full_name, p.phone
        HAVING COUNT(*) FILTER (WHERE b.status = 'NO_SHOW') > 0
      `;

      // Query untuk walk-in patients (dari temporary_patients)
      const walkInQuery = `
        SELECT 
          tp.id as patient_id,
          tp.full_name as patient_name,
          tp.phone as phone,
          COUNT(*) FILTER (WHERE b.status = 'NO_SHOW') as no_show_count,
          MAX(b.no_show_at) as last_no_show_date,
          COUNT(*) as total_bookings,
          true as is_walk_in
        FROM temporary_patients tp
        JOIN bookings b ON tp.id = b.temp_patient_id
        WHERE tp.branch_id = $1
          AND tp.deleted_at IS NULL
          AND tp.converted_to_patient_id IS NULL
        GROUP BY tp.id, tp.full_name, tp.phone
        HAVING COUNT(*) FILTER (WHERE b.status = 'NO_SHOW') > 0
      `;

      // UNION kedua query
      const fullQuery = `
        SELECT * FROM (${regularQuery} UNION ${walkInQuery}) combined
        ORDER BY no_show_count DESC
        LIMIT $2
      `;

      const result = await this.pool.query(fullQuery, [branchId, limit]);

      return result.rows.map(row => ({
        patientId: row.patient_id,
        patientName: row.patient_name,
        phone: row.phone || 'N/A',
        noShowCount: parseInt(row.no_show_count) || 0,
        lastNoShowDate: row.last_no_show_date || null,
        totalBookings: parseInt(row.total_bookings) || 0,
        isWalkIn: row.is_walk_in,
      }));
    } catch (error: unknown) {
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error fetching no-show summary');
      throw new Error('Failed to fetch no-show summary');
    }
  }

  /**
   * Get attendance trend for a patient (last 3 months)
   */
  async getPatientTrend(patientId: string): Promise<any[]> {
    try {
      const query = `
        SELECT 
          DATE_TRUNC('month', booking_date) as month,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
          COUNT(*) FILTER (WHERE status = 'NO_SHOW') as no_shows,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancellations
        FROM bookings
        WHERE patient_id = $1
          AND booking_date >= CURRENT_DATE - INTERVAL '3 months'
        GROUP BY DATE_TRUNC('month', booking_date)
        ORDER BY month DESC
      `;
      const result = await this.pool.query(query, [patientId]);
      return result.rows.map(row => ({
        month: row.month,
        total: parseInt(row.total),
        completed: parseInt(row.completed),
        noShows: parseInt(row.no_shows),
        cancellations: parseInt(row.cancellations),
      }));
    } catch (error: unknown) {
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error fetching patient trend');
      throw new Error('Failed to fetch patient trend');
    }
  }
}
