import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface PatientAttendance {
  patientId: string;
  totalBookings: number;
  completed: number;
  noShows: number;
  cancellations: number;
  showRate: number; // percentage (completed / totalBookings * 100)
}

export interface NoShowSummary {
  patientId: string;
  patientName: string;
  phone: string;
  noShowCount: number;
  lastNoShowDate: Date | null;
  totalBookings: number;
}

export class AttendanceReportService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  /**
   * Get attendance statistics for a specific patient
   */
  async getPatientAttendanceRate(patientId: string): Promise<PatientAttendance> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_bookings,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
          COUNT(*) FILTER (WHERE status = 'NO_SHOW') as no_shows,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancellations
        FROM bookings
        WHERE pasien_id = $1
          AND deleted_at IS NULL
      `;
      const result = await this.pool.query(query, [patientId]);
      const row = result.rows[0];

      const totalBookings = parseInt(row.total_bookings) || 0;
      const completed = parseInt(row.completed) || 0;
      const noShows = parseInt(row.no_shows) || 0;
      const cancellations = parseInt(row.cancellations) || 0;

      // Show rate = completed / totalBookings * 100 (only if total > 0)
      const showRate = totalBookings > 0 ? (completed / totalBookings) * 100 : 0;

      return {
        patientId,
        totalBookings,
        completed,
        noShows,
        cancellations,
        showRate: Math.round(showRate * 100) / 100, // round to 2 decimals
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error({ error: err.message, stack: err.stack }, 'Error fetching patient attendance');
      throw new Error('Failed to fetch patient attendance');
    }
  }

  /**
   * Get no-show summary for a branch (top chronic no-shows)
   * Returns patients sorted by no-show count descending
   */
  async getNoShowSummary(branchId: string, limit: number = 20): Promise<NoShowSummary[]> {
    try {
      const query = `
        SELECT 
          u.id as patient_id,
          u.full_name as patient_name,
          u.phone_number as phone,
          COUNT(*) FILTER (WHERE b.status = 'NO_SHOW') as no_show_count,
          MAX(b.no_show_at) as last_no_show_date,
          COUNT(*) as total_bookings
        FROM users u
        JOIN bookings b ON u.id = b.pasien_id
        WHERE u.branch_id = $1
          AND u.role = 'PATIENT'
          AND b.deleted_at IS NULL
          AND u.deleted_at IS NULL
        GROUP BY u.id, u.full_name, u.phone_number
        HAVING COUNT(*) FILTER (WHERE b.status = 'NO_SHOW') > 0
        ORDER BY no_show_count DESC
        LIMIT $2
      `;
      const result = await this.pool.query(query, [branchId, limit]);
      
      return result.rows.map(row => ({
        patientId: row.patient_id,
        patientName: row.patient_name,
        phone: row.phone || '-',
        noShowCount: parseInt(row.no_show_count),
        lastNoShowDate: row.last_no_show_date,
        totalBookings: parseInt(row.total_bookings),
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
        WHERE pasien_id = $1
          AND booking_date >= CURRENT_DATE - INTERVAL '3 months'
          AND deleted_at IS NULL
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
